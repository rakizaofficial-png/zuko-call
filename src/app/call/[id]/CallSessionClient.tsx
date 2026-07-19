"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Gift,
  Mic,
  MicOff,
  PhoneOff,
  SwitchCamera,
} from "lucide-react";
import { CoinDeductFlash } from "@/components/call/CoinDeductFlash";
import { FakeLiveVideoPlayer } from "@/components/call/FakeLiveVideoPlayer";
import { TrialPaywall } from "@/components/call/TrialPaywall";
import { GiftSheet } from "@/components/GiftSheet";
import { useCallSessionEngine } from "@/hooks/useCallSessionEngine";
import { FREE_TRIAL_SECONDS } from "@/lib/engagement";
import {
  setUserMuted,
  stopUserAgoraCall,
  switchUserCamera,
} from "@/lib/agora";
import { billCallMinute } from "@/lib/callBilling";
import { effectiveRate } from "@/lib/ledger";
import { useApp } from "@/lib/store";
import { spendCoinsApi } from "@/lib/walletApi";

/**
 * Active call UI — Agora live OR AI prerecorded fallback.
 * Per-minute billing + synced hang-up. Overlay kept minimal.
 */
export default function CallSessionClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const preferLiveBridge = search.get("live") === "1";
  const isBlur = search.get("blur") === "1";
  const trialParam = search.get("trial") === "1";
  const {
    spendAsync,
    pushToast,
    isPremium,
    coins,
    syncWallet,
    freeTrialAvailable,
    useFreeTrial,
    endFreeTrial,
    completeCallEngagement,
    completeGiftEngagement,
  } = useApp();

  const [trialMode, setTrialMode] = useState(false);

  useEffect(() => {
    if (trialParam && freeTrialAvailable && useFreeTrial()) {
      setTrialMode(true);
      pushToast("Free 30s trial started");
    }
  }, [trialParam, freeTrialAvailable, useFreeTrial, pushToast]);

  const engine = useCallSessionEngine({
    hostId: id,
    enabled: true,
    preferLiveBridge,
    onConnected: ({ transport, name }) => {
      pushToast(
        transport === "ai_prerecorded"
          ? `${name} · preview host (AI clip) while live hosts are busy`
          : `You’re live with ${name}`,
      );
    },
    onFailed: (message) => pushToast(message),
  });

  const {
    state,
    transport,
    statusText,
    aiHost,
    remoteRef,
    localRef,
    disconnect,
    ratePerMinute,
    displayName,
    displayAvatar,
    bridgeCall,
    liveHost,
  } = engine;

  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [trialPaywall, setTrialPaywall] = useState(false);
  const [deductFlash, setDeductFlash] = useState<number | null>(null);
  const hangUpRef = useRef<() => Promise<void>>(async () => undefined);
  const trialEndedRef = useRef(false);
  const billingPausedRef = useRef(false);
  const billingBusyRef = useRef(false);

  const rate = isBlur
    ? Math.round(effectiveRate(ratePerMinute, isPremium) * 0.5)
    : effectiveRate(ratePerMinute, isPremium);

  const isRinging = state === "RINGING" || state === "ROUTING";
  const isConnected = state === "CONNECTED";
  const isFailed = state === "FAILED";
  const isAi = transport === "ai_prerecorded";
  const giftHostId = liveHost?.id || bridgeCall?.hostId || id;

  const hangUp = async () => {
    await disconnect();
    await stopUserAgoraCall();
    if (isConnected) void completeCallEngagement();
    pushToast("Call ended");
    router.push("/call");
  };
  hangUpRef.current = hangUp;

  // Timer + per-minute billing (60s)
  useEffect(() => {
    if (!isConnected) return;

    const tick = setInterval(() => {
      setSecs((s) => {
        const next = s + 1;

        if (trialMode && !trialEndedRef.current && next >= FREE_TRIAL_SECONDS) {
          trialEndedRef.current = true;
          billingPausedRef.current = true;
          endFreeTrial();
          setTrialMode(false);
          setTrialPaywall(true);
          return next;
        }

        if (trialMode || billingPausedRef.current) {
          return next;
        }

        // Every full minute after connect
        if (next > 0 && next % 60 === 0) {
          void (async () => {
            if (billingBusyRef.current) return;
            billingBusyRef.current = true;
            try {
              if (bridgeCall?.id && !isAi) {
                const result = await billCallMinute(bridgeCall.id);
                if (result.ok) {
                  setDeductFlash(result.amount ?? rate);
                  setTimeout(() => setDeductFlash(null), 900);
                  await syncWallet?.();
                } else if (result.exhausted) {
                  pushToast("Coins exhausted. Disconnecting...");
                  await hangUpRef.current();
                } else {
                  pushToast(result.error || "Billing failed");
                }
              } else {
                const ok = await spendAsync(
                  rate,
                  `−${rate} coins · 1 min`,
                );
                if (ok) {
                  setDeductFlash(rate);
                  setTimeout(() => setDeductFlash(null), 900);
                } else {
                  // Fallback path when spendAsync returns false
                  try {
                    await spendCoinsApi({
                      amount: rate,
                      reason: `call_minute_ai_${id}`,
                    });
                    setDeductFlash(rate);
                    setTimeout(() => setDeductFlash(null), 900);
                  } catch {
                    pushToast("Coins exhausted. Disconnecting...");
                    await hangUpRef.current();
                  }
                }
              }
            } finally {
              billingBusyRef.current = false;
            }
          })();
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
    };
  }, [
    isConnected,
    rate,
    spendAsync,
    pushToast,
    trialMode,
    endFreeTrial,
    bridgeCall?.id,
    isAi,
    syncWallet,
    id,
  ]);

  // Leave UI when engine reports disconnect from remote peer
  useEffect(() => {
    if (state === "DISCONNECTED") {
      void stopUserAgoraCall();
      router.push("/call");
    }
  }, [state, router]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#06040b]">
      {isAi && aiHost && (
        <FakeLiveVideoPlayer
          aiHost={aiHost}
          active={isConnected}
          muted={false}
        />
      )}

      {!isConnected && (
        <Image
          src={displayAvatar}
          alt={displayName}
          fill
          priority
          className="object-cover brightness-75"
        />
      )}

      {isRinging && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-[#06040b] via-ink-2 to-coral/30">
          <Image
            src={displayAvatar}
            alt=""
            width={120}
            height={120}
            className="relative h-28 w-28 rounded-full object-cover ring-4 ring-coral/50"
          />
          <p className="mt-6 font-display text-2xl font-extrabold">
            {displayName}
          </p>
          <p className="mt-2 animate-pulse text-sm font-semibold text-cyan">
            Connecting…
          </p>
          <p className="mt-1 text-xs text-gold/80">{statusText}</p>
        </div>
      )}

      <div
        ref={remoteRef}
        id="agora-remote"
        className={`absolute inset-0 bg-black ${
          isConnected && !isAi ? "z-[1] opacity-100" : "z-0 opacity-0"
        }`}
      />

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/50 via-transparent to-black/80" />

      <CoinDeductFlash amount={deductFlash} />

      <div className="absolute right-4 top-24 z-20 h-36 w-28 overflow-hidden rounded-2xl border border-white/20 bg-ink-3 shadow-xl">
        <div
          ref={localRef}
          id="agora-local"
          className="h-full w-full bg-gradient-to-br from-ink-3 to-coral/30"
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-center">
          <div className="rounded-full bg-black/45 px-3 py-1.5 text-center backdrop-blur">
            <p className="text-xs font-bold">
              {isFailed ? "Failed" : isConnected ? "Private 1v1" : "Connecting…"}
            </p>
            <p className="font-mono text-sm tabular-nums text-gold">
              {mm}:{ss}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-extrabold">{displayName}</h1>
          <p className="mt-1 text-sm text-white/70">
            {trialMode
              ? "Complimentary intro · no coins yet"
              : `${rate} coins/min · ${coins} coins left`}
          </p>
          <p className="mt-2 text-xs text-white/50">{statusText}</p>
        </div>

        <div className="mt-auto flex flex-col items-center gap-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setMuted((m) => {
                  const next = !m;
                  if (!isAi) void setUserMuted(next);
                  return next;
                });
              }}
              className="rounded-full bg-white/15 p-4 backdrop-blur"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isAi) void switchUserCamera();
              }}
              className="rounded-full bg-white/15 p-4 backdrop-blur"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setGiftOpen(true)}
              className="rounded-full bg-coral p-4 shadow-[0_0_20px_var(--glow)]"
              aria-label="Send gift"
            >
              <Gift className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void hangUp()}
              className="rounded-full bg-red-500 p-4 shadow-lg"
              aria-label="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        hostId={giftHostId}
        callId={bridgeCall?.id}
        onSent={() => {
          void completeGiftEngagement();
        }}
      />
      <TrialPaywall
        open={trialPaywall}
        hostName={displayName}
        onContinueWithCoins={() => {
          billingPausedRef.current = false;
          setTrialPaywall(false);
          trialEndedRef.current = true;
        }}
        onClose={() => {
          billingPausedRef.current = false;
          setTrialPaywall(false);
          void hangUp();
        }}
      />
    </main>
  );
}
