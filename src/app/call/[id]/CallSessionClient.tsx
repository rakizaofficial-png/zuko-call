"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  SwitchCamera,
  Video,
  VideoOff,
} from "lucide-react";
import { CallWaveform } from "@/components/call/CallWaveform";
import { CoinDeductFlash } from "@/components/call/CoinDeductFlash";
import { FakeLiveVideoPlayer } from "@/components/call/FakeLiveVideoPlayer";
import { TrialPaywall } from "@/components/call/TrialPaywall";
import { GiftSheet } from "@/components/GiftSheet";
import { LowBalanceModal } from "@/components/LowBalanceModal";
import { useCallSessionEngine } from "@/hooks/useCallSessionEngine";
import { FREE_TRIAL_SECONDS } from "@/lib/engagement";
import {
  setUserCameraOff,
  setUserMuted,
  stopUserAgoraCall,
} from "@/lib/agora";
import { effectiveRate, sliceCost } from "@/lib/ledger";
import { useApp } from "@/lib/store";

/**
 * Active call UI — Agora live OR AI prerecorded fallback.
 * Coin ledger (10s slices) + one-time 30s free trial for new users.
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
    openTopUp,
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
  } = engine;

  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [blurReveal, setBlurReveal] = useState(isBlur ? 0.08 : 1);
  const [lowBalance, setLowBalance] = useState(false);
  const [graceLeft, setGraceLeft] = useState(15);
  const [trialPaywall, setTrialPaywall] = useState(false);
  const [deductFlash, setDeductFlash] = useState<number | null>(null);
  const [netQuality] = useState<"Excellent" | "Good" | "Fair">("Good");
  const graceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hangUpRef = useRef<() => Promise<void>>(async () => undefined);
  const trialEndedRef = useRef(false);
  const billingPausedRef = useRef(false);

  const rate = isBlur
    ? Math.round(effectiveRate(ratePerMinute, isPremium) * 0.5)
    : effectiveRate(ratePerMinute, isPremium);

  const isRinging = state === "RINGING" || state === "ROUTING";
  const isConnected = state === "CONNECTED";
  const isFailed = state === "FAILED";
  const isAi = transport === "ai_prerecorded";

  const hangUp = async () => {
    await disconnect();
    await stopUserAgoraCall();
    if (isConnected) void completeCallEngagement();
    pushToast("Call ended");
  };
  hangUpRef.current = hangUp;

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
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(40);
          }
          return next;
        }

        if (trialMode || billingPausedRef.current) {
          return next;
        }

        if (isBlur && next % 10 === 0) {
          setBlurReveal((b) => Math.min(1, b + 0.12));
        }

        if (next > 0 && next % 10 === 0) {
          const cost = sliceCost(rate);
          void (async () => {
            const ok = await spendAsync(cost, `−${cost} coins · 10s`);
            setDeductFlash(cost);
            setTimeout(() => setDeductFlash(null), 900);
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate?.(12);
            }
            if (!ok) {
              setLowBalance(true);
              setGraceLeft(15);
              openTopUp(15);
              if (!graceRef.current) {
                graceRef.current = setInterval(() => {
                  setGraceLeft((g) => {
                    if (g <= 1) {
                      if (graceRef.current) clearInterval(graceRef.current);
                      graceRef.current = null;
                      void hangUpRef.current();
                      pushToast("Call ended — top up to continue");
                      return 0;
                    }
                    return g - 1;
                  });
                }, 1000);
              }
            } else if (lowBalance) {
              setLowBalance(false);
              if (graceRef.current) {
                clearInterval(graceRef.current);
                graceRef.current = null;
              }
            }
          })();
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
  }, [
    isBlur,
    isConnected,
    rate,
    spendAsync,
    pushToast,
    lowBalance,
    openTopUp,
    trialMode,
    endFreeTrial,
  ]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const trialLeft = Math.max(0, FREE_TRIAL_SECONDS - secs);

  const clearBlur = () => {
    if (!isBlur || blurReveal >= 1) return;
    const bonus = Math.max(20, Math.round(rate * 0.4));
    void (async () => {
      const ok = await spendAsync(bonus, `Instant Clear · −${bonus} coins`);
      if (ok) setBlurReveal(1);
    })();
  };

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
          className={`object-cover transition ${
            camOff ? "blur-xl brightness-50" : "brightness-75"
          }`}
        />
      )}

      {isRinging && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-[#06040b] via-ink-2 to-coral/30">
          <div className="relative mb-6">
            <span className="absolute inset-0 animate-ping rounded-full bg-coral/40" />
            <Image
              src={displayAvatar}
              alt=""
              width={120}
              height={120}
              className="relative h-28 w-28 rounded-full object-cover ring-4 ring-coral/50"
            />
          </div>
          <p className="font-display text-2xl font-extrabold">{displayName}</p>
          <p className="mt-2 animate-pulse text-sm font-semibold text-cyan">
            Connecting to Host…
          </p>
          <p className="mt-1 text-xs text-gold/80">{statusText}</p>
          <div className="mt-6">
            <CallWaveform active />
          </div>
        </div>
      )}

      <div
        ref={remoteRef}
        id="agora-remote"
        className={`absolute inset-0 bg-black ${
          isConnected && !isAi ? "z-[1] opacity-100" : "z-0 opacity-0"
        }`}
      />

      {isBlur && blurReveal < 1 && isConnected && (
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

      <CoinDeductFlash amount={deductFlash} />

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
        {!isConnected && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">
            You
          </div>
        )}
        {isConnected && isAi && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent pb-2 text-[10px] font-bold text-white/80">
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
              {trialMode
                ? "Free trial"
                : isRinging
                  ? "Connecting…"
                  : isConnected
                    ? isAi
                      ? "Private 1v1"
                      : "Private 1v1 · Live"
                    : isFailed
                      ? "Failed"
                      : "1v1"}
            </p>
            <p className="font-mono text-sm tabular-nums text-gold">
              {mm}:{ss}
              {trialMode ? ` · ${trialLeft}s left` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setGiftOpen(true);
            }}
            className="rounded-full bg-coral p-2 shadow-[0_0_20px_var(--glow)]"
          >
            <Gift className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          {isConnected ? (
            <div className="relative mb-4">
              <Image
                src={displayAvatar}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-coral/40"
              />
              <span className="online-pulse absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-ink bg-teal" />
            </div>
          ) : null}
          <h1 className="font-display text-3xl font-extrabold">{displayName}</h1>
          <p className="mt-1 text-sm text-white/70">
            {trialMode
              ? "Complimentary intro · no coins yet"
              : `${rate} coins/min${isBlur ? " · Blind 50% off" : isPremium ? " · VIP −15%" : ""} · ${coins} coins left`}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-cyan">
            <Signal className="h-3.5 w-3.5" />
            Network {netQuality}
          </div>
          {isConnected ? (
            <div className="mt-4">
              <CallWaveform active={!muted} />
            </div>
          ) : null}
          <p className="mt-3 text-sm text-white/80">{statusText}</p>
          {isBlur && blurReveal < 1 && isConnected && (
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
                  if (!isAi) void setUserMuted(next);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate?.(8);
                  }
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
                  if (!isAi) void setUserCameraOff(next);
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
            {isConnected
              ? "Secure private session"
              : "Establishing encrypted media path…"}
          </p>
        </div>
      </div>

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        onSent={() => {
          void completeGiftEngagement();
        }}
      />
      <LowBalanceModal
        open={lowBalance}
        graceLeft={graceLeft}
        onDismiss={() => setLowBalance(false)}
        minuteRate={rate}
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
          router.push("/call");
        }}
      />
    </main>
  );
}
