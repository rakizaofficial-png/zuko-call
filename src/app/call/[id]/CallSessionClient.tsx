"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Mic,
  MicOff,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
} from "lucide-react";
import { GiftSheet } from "@/components/GiftSheet";
import { LowBalanceModal } from "@/components/LowBalanceModal";
import {
  createCall,
  endCall as endBridgeCall,
  fetchCallToken,
  fetchLiveHosts,
  waitForAccept,
  type BridgeCall,
  type LiveHost,
} from "@/lib/api";
import {
  setUserCameraOff,
  setUserMuted,
  startUserAgoraCall,
  stopUserAgoraCall,
} from "@/lib/agora";
import { creators } from "@/lib/data";
import { effectiveRate, sliceCost } from "@/lib/ledger";
import { useApp } from "@/lib/store";

function creatorsSafe(id: string) {
  return creators.find((c) => c.id === id) ?? null;
}

export default function CallSessionClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const search = useSearchParams();
  const isLive = search.get("live") === "1";
  const isBlur = search.get("blur") === "1";
  const { spend, pushToast, isPremium, coins } = useApp();

  const demoCreator = !isLive
    ? creatorsSafe(id)
    : null;

  const [liveHost, setLiveHost] = useState<LiveHost | null>(null);
  const [phase, setPhase] = useState<
    "loading" | "ringing" | "connected" | "demo" | "failed"
  >(isLive ? "loading" : "demo");
  const [statusText, setStatusText] = useState("Preparing…");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [blurReveal, setBlurReveal] = useState(isBlur ? 0.08 : 1);
  const [lowBalance, setLowBalance] = useState(false);
  const [graceLeft, setGraceLeft] = useState(15);
  const [bridgeCall, setBridgeCall] = useState<BridgeCall | null>(null);
  const callIdRef = useRef<string | null>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const graceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayName =
    liveHost?.name || demoCreator?.name || bridgeCall?.hostName || "Host";
  const displayImage =
    liveHost?.avatarUrl ||
    demoCreator?.image ||
    `https://i.pravatar.cc/800?u=${encodeURIComponent(id)}`;
  const baseRate =
    liveHost?.ratePerMinute ||
    bridgeCall?.ratePerMinute ||
    demoCreator?.callRate ||
    80;
  const rate = isBlur
    ? Math.round(effectiveRate(baseRate, isPremium) * 0.5)
    : effectiveRate(baseRate, isPremium);

  useEffect(() => {
    if (!isLive) {
      setPhase("demo");
      setStatusText("Demo mode — not connected to CoinCall host");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatusText("Finding host on CoinCall…");
        const hosts = await fetchLiveHosts();
        const host = hosts.find((h) => h.id === id);
        if (!host) {
          setPhase("failed");
          setStatusText("Host went offline. Ask them to Go Online.");
          return;
        }
        if (cancelled) return;
        setLiveHost(host);

        setPhase("ringing");
        setStatusText(`Ringing ${host.name} on CoinCall…`);

        const userId = `luma_${Math.random().toString(36).slice(2, 9)}`;
        const call = await createCall({
          hostId: host.id,
          userId,
          userName: "Luma Fan",
        });
        if (cancelled) return;
        callIdRef.current = call.id;
        setBridgeCall(call);

        const accepted = await waitForAccept(call.id, (st) => {
          if (st === "ringing") setStatusText(`Waiting for ${host.name}…`);
        });
        if (cancelled) return;
        setBridgeCall(accepted);

        setStatusText("Host accepted · joining video…");
        const token = await fetchCallToken(accepted.id);
        if (cancelled) return;

        // Wait until video surfaces are in the DOM and painted
        for (let i = 0; i < 40; i++) {
          if (localRef.current && remoteRef.current) break;
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
        if (!localRef.current || !remoteRef.current) {
          throw new Error("Video surface missing — reload and allow camera");
        }

        // Show surfaces before joining so Agora has sized containers
        setPhase("connected");
        setStatusText("Starting camera…");
        await new Promise((r) => setTimeout(r, 120));

        await startUserAgoraCall({
          appId: token.appId,
          channel: token.channel,
          token: token.token,
          uid: token.uid,
          localVideoEl: localRef.current,
          remoteVideoEl: remoteRef.current,
        });

        if (cancelled) return;
        setStatusText(`Connected with ${host.name}`);
        pushToast(`You’re live with ${host.name}`);
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not connect";
        setPhase("failed");
        setStatusText(message);
        pushToast(message);
      }
    })();

    return () => {
      cancelled = true;
      void stopUserAgoraCall();
      if (callIdRef.current) {
        void endBridgeCall(callIdRef.current);
        callIdRef.current = null;
      }
    };
  }, [id, isLive, pushToast]);

  useEffect(() => {
    if (isLive || phase !== "demo") return;
    const t = setTimeout(() => {
      setStatusText(`Demo with ${displayName}`);
      pushToast("Demo call — use live hosts for real CoinCall connect");
    }, 800);
    return () => clearTimeout(t);
  }, [displayName, isLive, phase, pushToast]);

  useEffect(() => {
    const billing =
      phase === "connected" || (!isLive && phase === "demo");
    if (!billing) return;

    const tick = setInterval(() => {
      setSecs((s) => {
        const next = s + 1;

        // Blueprint: reveal blur a bit every 10 seconds
        if (isBlur && next % 10 === 0) {
          setBlurReveal((b) => Math.min(1, b + 0.12));
        }

        // Blueprint: deduct Rm/6 every 10 seconds
        if (next > 0 && next % 10 === 0) {
          const cost = sliceCost(rate);
          const ok = spend(cost, `−${cost} coins · 10s`);
          if (!ok) {
            setLowBalance(true);
            setGraceLeft(15);
            if (!graceRef.current) {
              graceRef.current = setInterval(() => {
                setGraceLeft((g) => {
                  if (g <= 1) {
                    if (graceRef.current) clearInterval(graceRef.current);
                    graceRef.current = null;
                    void hangUp();
                    pushToast("Call ended — low balance");
                    return 0;
                  }
                  return g - 1;
                });
              }, 1000);
            }
          } else if (ok && lowBalance) {
            setLowBalance(false);
            if (graceRef.current) {
              clearInterval(graceRef.current);
              graceRef.current = null;
            }
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      if (graceRef.current) {
        clearInterval(graceRef.current);
        graceRef.current = null;
      }
    };
    // hangUp intentionally omitted — stable enough via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlur, isLive, isPremium, phase, rate, spend, pushToast, lowBalance]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const hangUp = async () => {
    await stopUserAgoraCall();
    if (callIdRef.current) {
      await endBridgeCall(callIdRef.current);
      callIdRef.current = null;
    }
    pushToast("Call ended");
  };

  const clearBlur = () => {
    if (!isBlur || blurReveal >= 1) return;
    const bonus = Math.max(20, Math.round(rate * 0.4));
    if (!spend(bonus, `Instant Clear · −${bonus} coins`)) return;
    setBlurReveal(1);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink">
      {phase !== "connected" && phase !== "ringing" && (
        <Image
          src={displayImage}
          alt={displayName}
          fill
          priority
          className={`object-cover transition ${camOff ? "blur-xl brightness-50" : "brightness-75"}`}
        />
      )}
      {(phase === "ringing" || phase === "loading") && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-ink via-ink-2 to-coral/30">
          <div className="relative mb-6">
            <span className="absolute inset-0 animate-ping rounded-full bg-coral/40" />
            <Image
              src={displayImage}
              alt=""
              width={120}
              height={120}
              className="relative h-28 w-28 rounded-full object-cover ring-4 ring-coral/50"
            />
          </div>
          <p className="font-display text-2xl font-extrabold">{displayName}</p>
          <p className="mt-2 text-sm text-gold">
            {phase === "ringing" ? "Ringing host…" : "Connecting…"}
          </p>
        </div>
      )}
      <div
        ref={remoteRef}
        id="agora-remote"
        className={`absolute inset-0 bg-black ${
          phase === "connected" ? "z-[1] opacity-100" : "z-0 opacity-0"
        }`}
      />
      {isBlur && blurReveal < 1 && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] backdrop-blur-2xl transition-all duration-700"
          style={{
            opacity: 1 - blurReveal,
            WebkitBackdropFilter: `blur(${Math.round((1 - blurReveal) * 28)}px)`,
            backdropFilter: `blur(${Math.round((1 - blurReveal) * 28)}px)`,
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-transparent to-black/85" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute right-4 top-24 z-20 h-36 w-28 overflow-hidden rounded-2xl border border-white/20 bg-ink-3 shadow-xl"
      >
        <div
          ref={localRef}
          id="agora-local"
          className="h-full w-full bg-gradient-to-br from-ink-3 to-coral/30"
        />
        {phase !== "connected" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">
            You
          </div>
        )}
      </motion.div>

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <Link
            href="/call"
            className="rounded-full bg-black/40 p-2 backdrop-blur"
            onClick={() => void hangUp()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-full bg-black/45 px-3 py-1.5 text-center backdrop-blur">
            <p className="text-xs font-bold">
              {phase === "ringing"
                ? "Ringing host…"
                : phase === "connected"
                  ? "Private 1v1 · CoinCall"
                  : phase === "failed"
                    ? "Failed"
                    : "Demo 1v1"}
            </p>
            <p className="font-mono text-sm tabular-nums text-gold">
              {mm}:{ss}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="rounded-full bg-coral p-2 shadow-[0_0_20px_var(--glow)]"
          >
            <Gift className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 text-center">
          <h1 className="font-display text-3xl font-extrabold">{displayName}</h1>
          <p className="mt-1 text-sm text-white/70">
            {rate} coins/min
            {isBlur ? " · Blind 50% off" : isPremium ? " · VIP −15%" : ""} ·{" "}
            {coins} coins left
          </p>
          <p className="mt-3 text-sm text-white/80">{statusText}</p>
          {isBlur && blurReveal < 1 && (
            <button
              type="button"
              onClick={clearBlur}
              className="relative z-30 mt-4 rounded-full border border-cyan/40 bg-cyan/20 px-4 py-2 text-xs font-bold text-cyan backdrop-blur"
            >
              Instant Clear · reveal now
            </button>
          )}
        </div>

        <div className="mt-auto flex flex-col items-center gap-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setMuted((m) => {
                  const next = !m;
                  void setUserMuted(next);
                  return next;
                });
              }}
              className="rounded-full bg-white/15 p-4 backdrop-blur"
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setCamOff((c) => {
                  const next = !c;
                  void setUserCameraOff(next);
                  return next;
                });
              }}
              className="rounded-full bg-white/15 p-4 backdrop-blur"
            >
              {camOff ? (
                <VideoOff className="h-5 w-5" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              className="rounded-full bg-white/15 p-4 backdrop-blur"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
            <Link
              href="/call"
              className="rounded-full bg-red-500 p-4 shadow-lg"
              onClick={() => void hangUp()}
            >
              <PhoneOff className="h-5 w-5" />
            </Link>
          </div>
          <p className="text-center text-xs text-white/50">
            {isLive
              ? "Host must accept in CoinCall app to connect"
              : "Open CoinCall host → Online → call from Live list"}
          </p>
        </div>
      </div>

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} />
      <LowBalanceModal
        open={lowBalance}
        graceLeft={graceLeft}
        onDismiss={() => setLowBalance(false)}
      />
    </main>
  );
}
