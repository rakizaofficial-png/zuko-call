"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  Sparkles,
  SwitchCamera,
} from "lucide-react";
import { CoinDeductFlash } from "@/components/call/CoinDeductFlash";
import { FakeLiveVideoPlayer } from "@/components/call/FakeLiveVideoPlayer";
import { TrialPaywall } from "@/components/call/TrialPaywall";
import { GiftSheet } from "@/components/GiftSheet";
import { LowBalanceModal } from "@/components/LowBalanceModal";
import { useCallSessionEngine } from "@/hooks/useCallSessionEngine";
import { FREE_TRIAL_SECONDS } from "@/lib/engagement";
import {
  setUserMuted,
  stopUserAgoraCall,
  switchUserCamera,
} from "@/lib/agora";
import { billCallMinute } from "@/lib/callBilling";
import { effectiveRate, maxCallMinutes } from "@/lib/ledger";
import { useApp } from "@/lib/store";
import { spendCoinsApi } from "@/lib/walletApi";

type FeedLine = { id: string; text: string; tone?: "system" | "gift" | "bill" };

/**
 * Immersive 1v1 call — edge-to-edge video, glass floating chrome.
 * Billing / Agora logic unchanged.
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
      pushFeed(`Connected with ${name}`, "system");
      pushToast(
        transport === "ai_prerecorded"
          ? `${name} · preview host (AI clip) while live hosts are busy`
          : `You’re live with ${name}`,
      );
    },
    onFailed: (message) => {
      pushToast(message);
      if (/insufficient balance/i.test(message)) {
        setLowBalanceOpen(true);
      }
    },
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
  const [beautyOn, setBeautyOn] = useState(true);
  const [trialPaywall, setTrialPaywall] = useState(false);
  const [lowBalanceOpen, setLowBalanceOpen] = useState(false);
  const [deductFlash, setDeductFlash] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const hangUpRef = useRef<() => Promise<void>>(async () => undefined);
  const trialEndedRef = useRef(false);
  const billingPausedRef = useRef(false);
  const billingBusyRef = useRef(false);
  const lowBalanceWarnedRef = useRef(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const isRinging = state === "RINGING" || state === "ROUTING";
  const isConnected = state === "CONNECTED";
  const isFailed = state === "FAILED";
  const isAi = transport === "ai_prerecorded";
  const giftHostId = liveHost?.id || bridgeCall?.hostId || id;

  const rate = isBlur
    ? Math.round(effectiveRate(ratePerMinute, isPremium) * 0.5)
    : effectiveRate(ratePerMinute, isPremium);
  /** Actual per-minute charge for live bridge (server) or AI (client rate) */
  const chargeRate =
    !isAi && bridgeCall?.ratePerMinute
      ? Math.max(1, Math.floor(bridgeCall.ratePerMinute))
      : rate;

  function pushFeed(text: string, tone: FeedLine["tone"] = "system") {
    setFeed((prev) =>
      [...prev, { id: `${Date.now()}_${Math.random()}`, text, tone }].slice(-24),
    );
  }

  const hangUp = async () => {
    await disconnect();
    await stopUserAgoraCall();
    if (isConnected) void completeCallEngagement();
    pushToast("Call ended");
    router.push("/call");
  };
  hangUpRef.current = hangUp;

  useEffect(() => {
    if (maxCallMinutes(coins, chargeRate) > 1) {
      lowBalanceWarnedRef.current = false;
    }
  }, [coins, chargeRate]);

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

        // 30s warning before balance can no longer cover another minute
        const minutesLeft = maxCallMinutes(coins, chargeRate);
        const secIntoMin = next % 60;
        const secsUntilExhaust = minutesLeft * 60 - secIntoMin;
        if (
          minutesLeft >= 1 &&
          secsUntilExhaust <= 30 &&
          secsUntilExhaust > 0 &&
          !lowBalanceWarnedRef.current
        ) {
          lowBalanceWarnedRef.current = true;
          setLowBalanceOpen(true);
          pushToast(
            "Your balance is running low. Please recharge to continue the call.",
          );
        }

        // Strict: cannot afford host rate → disconnect both sides
        if (coins < chargeRate && next > 2) {
          pushToast("Insufficient balance, please recharge");
          void hangUpRef.current();
          return next;
        }

        if (next > 0 && next % 60 === 0) {
          void (async () => {
            if (billingBusyRef.current) return;
            billingBusyRef.current = true;
            try {
              if (bridgeCall?.id && !isAi) {
                const result = await billCallMinute(bridgeCall.id);
                if (result.ok) {
                  const amt = result.amount ?? chargeRate;
                  setDeductFlash(amt);
                  setTimeout(() => setDeductFlash(null), 900);
                  pushFeed(`−${amt} coins · 1 min`, "bill");
                  await syncWallet?.();
                  const bal = result.coinBalance ?? coins - amt;
                  if (bal < chargeRate) {
                    pushToast("Coins exhausted. Disconnecting...");
                    await hangUpRef.current();
                  } else if (maxCallMinutes(bal, chargeRate) <= 1) {
                    lowBalanceWarnedRef.current = false;
                  }
                } else if (result.exhausted) {
                  pushToast("Coins exhausted. Disconnecting...");
                  await hangUpRef.current();
                } else {
                  pushToast(result.error || "Billing failed");
                }
              } else {
                const ok = await spendAsync(chargeRate, `−${chargeRate} coins · 1 min`);
                if (ok) {
                  setDeductFlash(chargeRate);
                  setTimeout(() => setDeductFlash(null), 900);
                  pushFeed(`−${chargeRate} coins · 1 min`, "bill");
                  await syncWallet?.();
                } else {
                  try {
                    await spendCoinsApi({
                      amount: chargeRate,
                      reason: `call_minute_ai_${id}`,
                    });
                    setDeductFlash(chargeRate);
                    setTimeout(() => setDeductFlash(null), 900);
                    pushFeed(`−${chargeRate} coins · 1 min`, "bill");
                    await syncWallet?.();
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

    return () => clearInterval(tick);
  }, [
    isConnected,
    chargeRate,
    spendAsync,
    pushToast,
    trialMode,
    endFreeTrial,
    bridgeCall?.id,
    isAi,
    syncWallet,
    id,
    coins,
  ]);

  useEffect(() => {
    if (state === "DISCONNECTED") {
      void stopUserAgoraCall();
      router.push("/call");
    }
  }, [state, router]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed.length]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const fab =
    "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-95";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
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
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-black via-black/80 to-[#1a0a14]/90">
          <span className="absolute h-36 w-36 animate-ping rounded-full bg-rose-500/20" />
          <Image
            src={displayAvatar}
            alt=""
            width={120}
            height={120}
            className="relative h-28 w-28 rounded-full object-cover ring-2 ring-white/40"
          />
          <p className="mt-6 font-display text-2xl font-extrabold text-white drop-shadow">
            {displayName}
          </p>
          <p className="mt-2 animate-pulse text-sm font-semibold text-cyan-300">
            Connecting…
          </p>
          <p className="mt-1 text-xs text-white/60">{statusText}</p>
        </div>
      )}

      {/* Edge-to-edge remote video */}
      <div
        ref={remoteRef}
        id="agora-remote"
        className={`absolute inset-0 bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
          isConnected && !isAi ? "z-[1] opacity-100" : "z-0 opacity-0"
        }`}
      />

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-transparent to-black/70" />

      <CoinDeductFlash amount={deductFlash} />

      {/* Floating glass header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex max-w-[70%] items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-3 shadow-lg backdrop-blur-xl">
            <Image
              src={displayAvatar}
              alt=""
              width={34}
              height={34}
              className="h-8.5 w-8.5 rounded-full object-cover ring-1 ring-white/30"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white drop-shadow">
                {displayName}
              </p>
              <p className="text-[10px] font-semibold text-white/70">
                {trialMode
                  ? "Free trial"
                  : isFailed
                    ? "Failed"
                    : isConnected
                      ? "Private 1v1"
                      : "Connecting"}
              </p>
            </div>
          </div>

          <div className="pointer-events-none flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              <span className="font-mono text-xs font-bold tabular-nums text-white">
                {mm}:{ss}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 backdrop-blur-xl">
              <Signal className="h-3 w-3 text-cyan-300" />
              <span className="text-[10px] font-bold text-cyan-200">Good</span>
            </div>
            <div className="rounded-full border border-amber-300/25 bg-amber-400/15 px-2.5 py-1 backdrop-blur-xl">
              <span className="text-[10px] font-bold text-amber-100 drop-shadow">
                {trialMode
                  ? "Complimentary"
                  : `${rate}/min · ${coins} left`}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Glow PiP */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute right-3 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-20 h-[148px] w-[108px] overflow-hidden rounded-[22px] border border-white/35 bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.45),0_0_28px_rgba(255,77,122,0.25)]"
      >
        <div
          ref={localRef}
          id="agora-local"
          className="h-full w-full bg-gradient-to-br from-zinc-800 to-rose-900/40 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur">
          You
        </span>
      </motion.div>

      {/* Bottom-left event / chat feed */}
      <div className="pointer-events-none absolute bottom-[7.5rem] left-3 z-20 max-h-[38vh] w-[min(72%,280px)] space-y-1.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {feed.map((line) => (
            <motion.p
              key={line.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[13px] leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] ${
                line.tone === "gift"
                  ? "font-semibold text-amber-200"
                  : line.tone === "bill"
                    ? "font-semibold text-rose-200"
                    : "text-white/95"
              }`}
            >
              {line.text}
            </motion.p>
          ))}
        </AnimatePresence>
        {!feed.length && isConnected ? (
          <p className="text-xs text-white/55 drop-shadow">
            Private session with {displayName}
          </p>
        ) : null}
        <div ref={feedEndRef} />
      </div>

      {/* Floating circular actions — bottom right */}
      <div className="pointer-events-auto absolute bottom-[max(1.1rem,env(safe-area-inset-bottom))] right-3 z-30 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setMuted((m) => {
              const next = !m;
              if (!isAi) void setUserMuted(next);
              return next;
            });
          }}
          className={fab}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isAi) void switchUserCamera();
          }}
          className={fab}
          aria-label="Flip camera"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setBeautyOn((v) => !v)}
          className={`${fab} ${beautyOn ? "ring-1 ring-violet-300/50" : ""}`}
          aria-label="Beauty filter"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setGiftOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-500 text-white shadow-[0_8px_28px_rgba(244,63,94,0.45)] transition active:scale-95"
          aria-label="Send gift"
        >
          <Gift className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void hangUp()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff2d55] text-white shadow-[0_10px_32px_rgba(255,45,85,0.55)] transition active:scale-95"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        hostId={giftHostId}
        callId={bridgeCall?.id}
        onSent={(emoji) => {
          pushFeed(`You sent ${emoji}`, "gift");
          void completeGiftEngagement();
        }}
      />
      <LowBalanceModal
        open={lowBalanceOpen}
        graceLeft={Math.max(
          0,
          maxCallMinutes(coins, chargeRate) * 60 - (secs % 60),
        )}
        minuteRate={chargeRate}
        warningMessage="Your balance is running low. Please recharge to continue the call."
        onDismiss={() => setLowBalanceOpen(false)}
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
