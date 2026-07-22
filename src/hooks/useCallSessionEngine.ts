"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  createCall,
  endCall as endBridgeCall,
  fetchCallToken,
  fetchHostProfile,
  getCall,
  waitForAccept,
  type BridgeCall,
  type LiveHost,
  fetchLiveHosts,
} from "@/lib/api";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";
import {
  startUserAgoraCall,
  stopUserAgoraCall,
} from "@/lib/agora";
import { fakeHandshakeDelayMs, routeOneToOneCall } from "@/lib/aiHosts/routeCall";
import type { AiHostRecord, CallEngineState, CallTransport } from "@/lib/aiHosts/types";
import {
  endCallSession,
  listenCallSessionEnded,
  upsertCallSession,
} from "@/lib/firebaseCallSession";
import { ensureFbWallet } from "@/lib/firebaseWallet";
import { isFirebaseReady } from "@/lib/firebase";
import { startRingingTone, stopRingingTone } from "@/lib/ringingTone";

export type CallSessionEngine = {
  state: CallEngineState;
  transport: CallTransport | null;
  statusText: string;
  aiHost: AiHostRecord | null;
  liveHost: LiveHost | null;
  bridgeCall: BridgeCall | null;
  /** Firebase / billing session id (bridge id or AI local id) */
  sessionId: string | null;
  remoteRef: RefObject<HTMLDivElement | null>;
  localRef: RefObject<HTMLDivElement | null>;
  disconnect: (opts?: { remoteEnded?: boolean; reason?: string }) => Promise<void>;
  ratePerMinute: number;
  displayName: string;
  displayAvatar: string;
};

/**
 * Production call-state engine:
 * IDLE → ROUTING → RINGING → CONNECTED → DISCONNECTED
 * Switches Agora live ↔ AI prerecorded backup player.
 */
export function useCallSessionEngine(opts: {
  hostId: string;
  enabled: boolean;
  preferLiveBridge: boolean;
  audioOnly?: boolean;
  onConnected?: (info: { transport: CallTransport; name: string }) => void;
  onFailed?: (message: string) => void;
}): CallSessionEngine {
  const { hostId, enabled, preferLiveBridge, audioOnly, onConnected, onFailed } = opts;
  const onConnectedRef = useRef(onConnected);
  const onFailedRef = useRef(onFailed);
  onConnectedRef.current = onConnected;
  onFailedRef.current = onFailed;

  const [state, setState] = useState<CallEngineState>("IDLE");
  const [transport, setTransport] = useState<CallTransport | null>(null);
  const [statusText, setStatusText] = useState("Preparing…");
  const [aiHost, setAiHost] = useState<AiHostRecord | null>(null);
  const [liveHost, setLiveHost] = useState<LiveHost | null>(null);
  const [bridgeCall, setBridgeCall] = useState<BridgeCall | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const remoteRef = useRef<HTMLDivElement | null>(null);
  const localRef = useRef<HTMLDivElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const endingRef = useRef(false);

  const disconnect = useCallback(async (opts?: {
    remoteEnded?: boolean;
    reason?: string;
  }) => {
    if (endingRef.current) return;
    endingRef.current = true;
    cancelledRef.current = true;
    stopRingingTone();
    await stopUserAgoraCall();

    const sid = sessionIdRef.current || callIdRef.current;
    if (sid && !opts?.remoteEnded && isFirebaseReady()) {
      await endCallSession(sid, opts?.reason || "user_hangup").catch(
        () => undefined,
      );
    }

    if (callIdRef.current) {
      if (!opts?.remoteEnded) {
        await endBridgeCall(callIdRef.current).catch(() => undefined);
      }
      callIdRef.current = null;
    }
    sessionIdRef.current = null;
    setSessionId(null);
    setState("DISCONNECTED");
    setStatusText("Call ended");
  }, []);

  // Real-time sync: leave when peer ends the call (Express + Firebase)
  useEffect(() => {
    if (state !== "CONNECTED") return;
    const callId = bridgeCall?.id || sessionId;
    if (!callId) return;
    let dead = false;

    const poll = bridgeCall?.id
      ? setInterval(() => {
          void getCall(bridgeCall.id)
            .then((c) => {
              if (dead) return;
              if (
                c.status === "ended" ||
                c.status === "missed" ||
                c.status === "rejected"
              ) {
                void disconnect({ remoteEnded: true, reason: "peer_ended" });
              }
            })
            .catch(() => undefined);
        }, 2000)
      : undefined;

    let offWs: (() => void) | undefined;
    if (bridgeCall?.id) {
      void import("@/lib/walletApi").then(({ getDeviceUserId }) => {
        void import("@/lib/realtime/websocket").then(({ getRealtimeClient }) => {
          if (dead) return;
          const rt = getRealtimeClient(getDeviceUserId());
          rt.connect();
          offWs = rt.subscribe((ev) => {
            if (ev.type !== "call:ended") return;
            const id = String((ev.payload as { id?: string })?.id || "");
            if (id && id !== bridgeCall.id) return;
            void disconnect({ remoteEnded: true, reason: "peer_ended" });
          });
        });
      });
    }

    const offFb = listenCallSessionEnded(callId, () => {
      if (dead) return;
      void disconnect({ remoteEnded: true, reason: "session_ended" });
    });

    return () => {
      dead = true;
      if (poll) clearInterval(poll);
      offWs?.();
      offFb();
    };
  }, [state, bridgeCall?.id, sessionId, disconnect]);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;
    endingRef.current = false;

    (async () => {
      try {
        setState("ROUTING");
        setStatusText("Finding the best connection…");

        // Prefer live Agora for real hosts — never silently swap to AI clips
        let decision = await routeOneToOneCall(hostId, {
          preferLive: preferLiveBridge || !/^ai[_-]/i.test(hostId),
        });
        try {
          const res = await fetch("/api/call-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hostId,
              preferLive: preferLiveBridge || !/^ai[_-]/i.test(hostId),
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              decision: typeof decision;
            };
            if (data.decision) decision = data.decision;
          }
        } catch {
          /* client routeCall already computed */
        }

        // Hard guard: never AI-convert an explicit live host call
        if (
          (preferLiveBridge || !/^ai[_-]/i.test(hostId)) &&
          decision.transport === "ai_prerecorded"
        ) {
          decision = {
            transport: "agora_live",
            reason: "Forced live bridge for user-selected host",
            realHostsOnline: decision.realHostsOnline,
            aiHost: null,
            liveHostId: hostId,
          };
        }

        if (cancelledRef.current) return;

        // --- AGORA LIVE PATH ---
        if (decision.transport === "agora_live" && decision.liveHostId) {
          setTransport("agora_live");
          const hosts = await fetchLiveHosts();
          let host =
            hosts.find((h) => h.id === decision.liveHostId) ||
            (await fetchHostProfile(decision.liveHostId));
          if (!host) {
            host = {
              id: decision.liveHostId,
              name: "Host",
              ratePerMinute: 80,
              isOnline: true,
              isLive: false,
              isOnCall: false,
            };
          }
          if (cancelledRef.current) return;
          setLiveHost(host);

          // Pre-check: block empty / insufficient wallets before ringing
          const { fetchOrCreateWallet, getDeviceUserId } = await import(
            "@/lib/walletApi"
          );
          const wallet = await fetchOrCreateWallet();
          const need = Math.max(1, Math.floor(Number(host.ratePerMinute) || 80));
          if (wallet.coinBalance < need) {
            throw new Error("Insufficient balance, please recharge");
          }

          setState("RINGING");
          setStatusText("Connecting to Host…");
          startRingingTone();
          await sleep(fakeHandshakeDelayMs());
          stopRingingTone();
          if (cancelledRef.current) return;

          setStatusText(`Ringing ${host.name}…`);
          const { getLocalProfile } = await import("@/lib/userProfile");
          const profile = getLocalProfile();
          const userId = getDeviceUserId() || profile.userId;
          const call = await createCall({
            hostId: host.id,
            userId,
            userName: profile.displayName,
            userAvatar: profile.avatarUrl,
          });
          if (cancelledRef.current) return;
          callIdRef.current = call.id;
          sessionIdRef.current = call.id;
          setSessionId(call.id);
          setBridgeCall(call);

          // Seed free-tier wallets + shared call session (no Cloud Functions)
          if (isFirebaseReady()) {
            await ensureFbWallet(userId, {
              coinBalance: wallet.coinBalance,
              displayName: profile.displayName,
              role: "user",
            });
            await ensureFbWallet(host.id, {
              displayName: host.name,
              role: "host",
            });
            await upsertCallSession({
              id: call.id,
              channel: call.channel,
              hostId: host.id,
              hostName: host.name,
              hostAvatar: host.avatarUrl,
              userId,
              userName: profile.displayName,
              userAvatar: profile.avatarUrl,
              ratePerMinute: need,
              status: "active",
              startedAt: Date.now(),
            });
          }

          const accepted = await waitForAccept(call.id, (st) => {
            if (st === "ringing") setStatusText(`Waiting for ${host.name}…`);
          });
          if (cancelledRef.current) return;
          setBridgeCall(accepted);

          setStatusText("Host accepted · joining video…");
          const token = await fetchCallToken(accepted.id);
          if (cancelledRef.current) return;

          for (let i = 0; i < 40; i++) {
            if (localRef.current && remoteRef.current) break;
            await new Promise((r) => requestAnimationFrame(() => r(null)));
          }
          if (!localRef.current || !remoteRef.current) {
            throw new Error("Video surface missing — allow camera");
          }

          setState("CONNECTED");
          await sleep(100);
          await startUserAgoraCall({
            appId: token.appId,
            channel: token.channel,
            token: token.token,
            uid: token.uid,
            localVideoEl: localRef.current,
            remoteVideoEl: remoteRef.current,
            audioOnly: Boolean(audioOnly),
          });
          if (cancelledRef.current) return;
          setStatusText(`Connected with ${host.name}`);
          onConnectedRef.current?.({ transport: "agora_live", name: host.name });
          return;
        }

        // --- AI / PRERECORDED FALLBACK PATH ---
        const ai = decision.aiHost;
        if (!ai) throw new Error("AI host catalog empty");

        const { fetchOrCreateWallet, getDeviceUserId } = await import(
          "@/lib/walletApi"
        );
        const wallet = await fetchOrCreateWallet();
        const aiRate = Math.max(
          1,
          Math.floor(Number(ai.cost_per_minute) || 80),
        );
        if (wallet.coinBalance < aiRate) {
          throw new Error("Insufficient balance, please recharge");
        }

        setTransport("ai_prerecorded");
        setAiHost(ai);
        setLiveHost(null);

        setState("RINGING");
        setStatusText("Connecting to Host…");
        startRingingTone();
        // Fake network handshake 2–4s — never instant
        await sleep(fakeHandshakeDelayMs());
        stopRingingTone();
        if (cancelledRef.current) return;

        const { getLocalProfile } = await import("@/lib/userProfile");
        const profile = getLocalProfile();
        const userId = getDeviceUserId() || profile.userId;
        const aiSession = `ai_${ai.host_id}_${Date.now()}`;
        callIdRef.current = null;
        sessionIdRef.current = aiSession;
        setSessionId(aiSession);

        if (isFirebaseReady()) {
          await ensureFbWallet(userId, {
            coinBalance: wallet.coinBalance,
            displayName: profile.displayName,
            role: "user",
          });
          await ensureFbWallet(ai.host_id, {
            displayName: ai.name,
            role: "host",
          });
          await upsertCallSession({
            id: aiSession,
            channel: `ai_${ai.host_id}`,
            hostId: ai.host_id,
            hostName: ai.name,
            hostAvatar: ai.avatar,
            userId,
            userName: profile.displayName,
            userAvatar: profile.avatarUrl,
            ratePerMinute: aiRate,
            status: "active",
            startedAt: Date.now(),
          });
        }

        setState("CONNECTED");
        setStatusText(`Connected with ${ai.name}`);
        onConnectedRef.current?.({ transport: "ai_prerecorded", name: ai.name });
      } catch (e: unknown) {
        if (cancelledRef.current) return;
        stopRingingTone();
        const message = e instanceof Error ? e.message : "Could not connect";
        setState("FAILED");
        setStatusText(message);
        onFailedRef.current?.(message);
      }
    })();

    return () => {
      cancelledRef.current = true;
      stopRingingTone();
      void stopUserAgoraCall();
      const sid = sessionIdRef.current || callIdRef.current;
      if (sid && isFirebaseReady() && !endingRef.current) {
        void endCallSession(sid, "cleanup").catch(() => undefined);
      }
      if (callIdRef.current) {
        void endBridgeCall(callIdRef.current);
        callIdRef.current = null;
      }
      sessionIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hostId, preferLiveBridge, audioOnly]);

  const ratePerMinute =
    aiHost?.cost_per_minute ||
    liveHost?.ratePerMinute ||
    bridgeCall?.ratePerMinute ||
    80;

  const displayName =
    aiHost?.name || liveHost?.name || bridgeCall?.hostName || "Host";
  const displayAvatar = pickHostAvatarUrl(
    {
      avatarUrl: aiHost?.avatar || liveHost?.avatarUrl,
    },
    { hostId, name: displayName },
  );

  return {
    state,
    transport,
    statusText,
    aiHost,
    liveHost,
    bridgeCall,
    sessionId,
    remoteRef,
    localRef,
    disconnect,
    ratePerMinute,
    displayName,
    displayAvatar,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
