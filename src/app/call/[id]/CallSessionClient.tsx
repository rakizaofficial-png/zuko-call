"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
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
  Volume2,
  VolumeX,
} from "lucide-react";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { CoinDeductFlash } from "@/components/call/CoinDeductFlash";
import { FakeLiveVideoPlayer } from "@/components/call/FakeLiveVideoPlayer";
import { TrialPaywall } from "@/components/call/TrialPaywall";
import { GiftSheet } from "@/components/GiftSheet";
import { LowBalanceModal } from "@/components/LowBalanceModal";
import { useCallSessionEngine } from "@/hooks/useCallSessionEngine";
import { FREE_TRIAL_SECONDS } from "@/lib/engagement";
import {
  setUserMuted,
  setUserSpeaker,
  stopUserAgoraCall,
  switchUserCamera,
  recoverUserCamera,
} from "@/lib/agora";
import { billCallMinute } from "@/lib/callBilling";
import {
  callMinuteTxId,
  hasCompletedTx,
  markTxCompleted,
  markTxFailed,
  recordPendingTx,
} from "@/lib/coinLedger";
import { transferCallMinuteFb } from "@/lib/firebaseWallet";
import { isFirebaseReady } from "@/lib/firebase";
import { effectiveRate, maxCallMinutes } from "@/lib/ledger";
import { useApp } from "@/lib/store";
import { getDeviceUserId } from "@/lib/walletApi";

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
  const preferLiveBridge =
    search.get("live") !== "0" && !/^ai[_-]/i.test(id);
  const isBlur = search.get("blur") === "1";
  const trialParam = search.get("trial") === "1";
  const audioOnly = search.get("audio") === "1";
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
    displayName: myDisplayName,
    applyLocalCoins,
    openTopUp,
  } = useApp();

  const [trialMode, setTrialMode] = useState(false);
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [netQuality, setNetQuality] = useState<"Excellent" | "Good" | "Fair" | "Low">(
    "Good",
  );
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
  const lowBalance60WarnedRef = useRef(false);
  const openTopUpRef = useRef(openTopUp);
  openTopUpRef.current = openTopUp;
  const feedEndRef = useRef<HTMLDivElement>(null);
  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;
  const insufficientExitRef = useRef(false);

  function pushFeed(text: string, tone: FeedLine["tone"] = "system") {
    setFeed((prev) =>
      [...prev, { id: `${Date.now()}_${Math.random()}`, text, tone }].slice(-24),
    );
  }
  const pushFeedRef = useRef(pushFeed);
  pushFeedRef.current = pushFeed;

  useEffect(() => {
    if (trialParam && freeTrialAvailable && useFreeTrial()) {
      setTrialMode(true);
      pushToastRef.current("Free 30s trial started");
    }
  }, [trialParam, freeTrialAvailable, useFreeTrial]);

  useEffect(() => {
    const readNet = () => {
      const conn = (
        navigator as Navigator & {
          connection?: { effectiveType?: string; downlink?: number };
        }
      ).connection;
      const type = conn?.effectiveType || "";
      const down = conn?.downlink ?? 0;
      if (type === "slow-2g" || type === "2g" || (down > 0 && down < 0.8)) {
        setNetQuality("Low");
      } else if (type === "3g" || (down > 0 && down < 2)) {
        setNetQuality("Fair");
      } else if (type === "4g" || down >= 5) {
        setNetQuality("Excellent");
      } else {
        setNetQuality("Good");
      }
    };
    readNet();
    const t = setInterval(readNet, 4000);
    return () => clearInterval(t);
  }, []);

  const lowNetWarnedRef = useRef(false);
  useEffect(() => {
    if (netQuality === "Low" && !lowNetWarnedRef.current) {
      lowNetWarnedRef.current = true;
      pushToastRef.current("Low network — video quality may drop");
    }
    if (netQuality === "Excellent" || netQuality === "Good") {
      lowNetWarnedRef.current = false;
    }
  }, [netQuality]);

  const engine = useCallSessionEngine({
    hostId: id,
    enabled: true,
    preferLiveBridge,
    audioOnly,
    onConnected: ({ transport, name }) => {
      pushFeedRef.current(`Connected with ${name}`, "system");
      pushToastRef.current(
        transport === "ai_prerecorded"
          ? `${name} · preview host (AI clip) while live hosts are busy`
          : `You’re live with ${name}`,
      );
    },
    onFailed: (message) => {
      pushToastRef.current(message);
      if (/insufficient balance|insufficient coins|recharge/i.test(message)) {
        insufficientExitRef.current = true;
        // Global TopUpSheet survives navigation — do not rely on local modal.
        openTopUpRef.current(30, "Insufficient Coins — recharge to place a call.");
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
    sessionId,
  } = engine;

  // Insufficient coins at call start — cancel request, show recharge, leave safely
  useEffect(() => {
    if (state !== "FAILED" || !insufficientExitRef.current) return;
    insufficientExitRef.current = false;
    let cancelled = false;
    void (async () => {
      try {
        await disconnect({ reason: "insufficient_coins" });
      } catch {
        /* ignore */
      }
      try {
        await stopUserAgoraCall();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      pushToastRef.current("Insufficient Coins");
      openTopUpRef.current(30, "Insufficient Coins — recharge to place a call.");
      router.replace("/call");
    })();
    return () => {
      cancelled = true;
    };
  }, [state, disconnect, router]);

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

  const hangUp = async () => {
    // Status → ended first so BOTH sides leave via RTDB listener
    await disconnect({ reason: "user_hangup" });
    await stopUserAgoraCall();
    if (isConnected) void completeCallEngagement();
    pushToast("Call ended");
    router.push("/call");
  };

  useEffect(() => {
    hangUpRef.current = hangUp;
  });

  const coinsRef = useRef(coins);
  const trialModeRef = useRef(trialMode);
  const chargeRateRef = useRef(chargeRate);
  const secsRef = useRef(0);
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);
  useEffect(() => {
    trialModeRef.current = trialMode;
  }, [trialMode]);
  useEffect(() => {
    chargeRateRef.current = chargeRate;
  }, [chargeRate]);

  useEffect(() => {
    if (maxCallMinutes(coins, chargeRate) > 1) {
      lowBalanceWarnedRef.current = false;
      lowBalance60WarnedRef.current = false;
    }
  }, [coins, chargeRate]);

  /** Coins gone → open recharge + hang up cleanly (both sides leave) */
  const exhaustAndRecharge = useCallback(async (msg?: string) => {
    setLowBalanceOpen(true);
    openTopUpRef.current(30);
    pushToastRef.current(msg || "Coins exhausted — recharge to continue");
    await hangUpRef.current();
  }, []);
  const exhaustRef = useRef(exhaustAndRecharge);
  exhaustRef.current = exhaustAndRecharge;

  useEffect(() => {
    if (!isConnected) return;

    secsRef.current = 0;
    setSecs(0);

    const tick = setInterval(() => {
      // Never call pushToast / other store updates inside a setState updater —
      // that updates AppProvider while CallSessionClient is rendering.
      const next = secsRef.current + 1;
      secsRef.current = next;
      setSecs(next);

      const bal = coinsRef.current;
      const charge = chargeRateRef.current;
      const trial = trialModeRef.current;

      if (trial && !trialEndedRef.current && next >= FREE_TRIAL_SECONDS) {
        trialEndedRef.current = true;
        billingPausedRef.current = true;
        endFreeTrial();
        setTrialMode(false);
        setTrialPaywall(true);
        return;
      }

      if (trial || billingPausedRef.current) {
        return;
      }

      // 60s toast + 30s popup before balance can no longer cover another minute
      const minutesLeft = maxCallMinutes(bal, charge);
      const secIntoMin = next % 60;
      const secsUntilExhaust = minutesLeft * 60 - secIntoMin;
      if (
        minutesLeft >= 1 &&
        secsUntilExhaust <= 60 &&
        secsUntilExhaust > 30 &&
        !lowBalance60WarnedRef.current
      ) {
        lowBalance60WarnedRef.current = true;
        pushToast("About 1 minute of coins left — recharge soon");
      }
      if (
        minutesLeft >= 1 &&
        secsUntilExhaust <= 30 &&
        secsUntilExhaust > 0 &&
        !lowBalanceWarnedRef.current
      ) {
        lowBalanceWarnedRef.current = true;
        setLowBalanceOpen(true);
        openTopUpRef.current(30);
        pushToast(
          "Your balance is running low. Please recharge to continue the call.",
        );
      }

      // Strict: cannot afford host rate → disconnect both sides + recharge
      if (bal < charge && next > 2) {
        void exhaustRef.current("Insufficient balance, please recharge");
        return;
      }

      if (next > 0 && next % 60 === 0) {
        void (async () => {
          if (billingBusyRef.current) return;
          billingBusyRef.current = true;
          try {
            const userId = getDeviceUserId();
            const hostIdForBill =
              bridgeCall?.hostId || liveHost?.id || aiHost?.host_id || id;
            const billSessionId = sessionId || bridgeCall?.id || `ai_${id}`;
            const chargeNow = chargeRateRef.current;
            const coinsNow = coinsRef.current;

            const minuteIndex = Math.floor(next / 60);
            const txId = callMinuteTxId(billSessionId, minuteIndex);
            if (hasCompletedTx(txId)) {
              billingBusyRef.current = false;
              return;
            }

            recordPendingTx({
              id: txId,
              userId: userId || getDeviceUserId(),
              hostId: hostIdForBill,
              callId: billSessionId,
              amount: chargeNow,
              type: "call_minute",
              reason: `call_minute_${billSessionId}_m${minuteIndex}`,
            });

            const onMinuteBilled = (amt: number, nextBal?: number) => {
              setDeductFlash(amt);
              setTimeout(() => setDeductFlash(null), 900);
              pushFeed(`−${amt} coins · 1 min`, "bill");
              markTxCompleted(txId);
              const bal =
                typeof nextBal === "number" ? nextBal : coinsNow - amt;
              if (typeof nextBal === "number") applyLocalCoins(nextBal);
              if (bal < chargeNow) {
                void exhaustRef.current();
              } else if (maxCallMinutes(bal, chargeNow) <= 1) {
                lowBalanceWarnedRef.current = false;
                lowBalance60WarnedRef.current = false;
              }
            };

            // Authoritative path: Express API (idempotent per minute)
            if (bridgeCall?.id && !isAi) {
              const expr = await billCallMinute(bridgeCall.id, {
                clientTxId: txId,
                minuteIndex,
                hostId: hostIdForBill,
              });
              if (expr.ok) {
                await syncWallet?.();
                onMinuteBilled(
                  expr.amount ?? chargeNow,
                  expr.coinBalance ?? coinsRef.current,
                );
              } else if (expr.exhausted) {
                markTxFailed(txId, expr.error || "exhausted");
                await exhaustRef.current();
              } else if (isFirebaseReady() && userId && hostIdForBill) {
                const fb = await transferCallMinuteFb({
                  userId,
                  hostId: hostIdForBill,
                  amount: chargeNow,
                  callId: billSessionId,
                  minuteIndex,
                  userName: myDisplayName,
                  hostName: displayName,
                });
                if (fb.ok) {
                  onMinuteBilled(fb.amount ?? chargeNow, fb.userBalance);
                } else if (fb.exhausted) {
                  markTxFailed(txId, "exhausted");
                  await exhaustRef.current();
                } else {
                  markTxFailed(txId, fb.error || "billing failed");
                  pushToast(fb.error || "Billing failed");
                }
              } else {
                markTxFailed(txId, expr.error || "billing failed");
                pushToast(expr.error || "Billing failed");
              }
            } else {
              const ok = await spendAsync(chargeNow, `−${chargeNow} coins · 1 min`, {
                type: isAi ? "video_call" : "call_minute",
                callId: billSessionId,
                hostId: hostIdForBill,
                clientTxId: txId,
              });
              if (ok) {
                onMinuteBilled(chargeNow);
                await syncWallet?.();
              } else {
                markTxFailed(txId, "spend failed");
                await exhaustRef.current();
              }
            }
          } catch (err) {
            pushToast(
              err instanceof Error
                ? err.message
                : "Billing error — balance will sync shortly",
            );
          } finally {
            billingBusyRef.current = false;
          }
        })();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [
    isConnected,
    spendAsync,
    pushToast,
    endFreeTrial,
    bridgeCall?.id,
    bridgeCall?.hostId,
    isAi,
    syncWallet,
    id,
    sessionId,
    liveHost?.id,
    aiHost?.host_id,
    myDisplayName,
    displayName,
    applyLocalCoins,
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
    <main className="relative h-dvh max-h-dvh overflow-hidden bg-black">
      {isAi && aiHost && (
        <FakeLiveVideoPlayer
          aiHost={aiHost}
          active={isConnected}
          muted={false}
        />
      )}

      {!isConnected && (
        <HostAvatarImg
          src={displayAvatar}
          hostId={id}
          name={displayName}
          alt={displayName}
          fill
          className="brightness-75"
        />
      )}

      {isRinging && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-black via-black/80 to-[#1a0a14]/90">
          <span className="absolute h-36 w-36 animate-ping rounded-full bg-rose-500/20" />
          <HostAvatarImg
            src={displayAvatar}
            hostId={id}
            name={displayName}
            alt=""
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
      <header className="safe-header pointer-events-none absolute inset-x-0 top-0 z-20 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex max-w-[70%] items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-3 shadow-lg backdrop-blur-xl">
            <HostAvatarImg
              src={displayAvatar}
              hostId={id}
              name={displayName}
              alt=""
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
              <Signal
                className={`h-3 w-3 ${
                  netQuality === "Low"
                    ? "text-rose-300"
                    : netQuality === "Fair"
                      ? "text-amber-300"
                      : "text-cyan-300"
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  netQuality === "Low"
                    ? "text-rose-200"
                    : netQuality === "Fair"
                      ? "text-amber-200"
                      : "text-cyan-200"
                }`}
              >
                {netQuality}
              </span>
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

      {/* Glow PiP — clamped inside viewport for all phone sizes */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute right-3 top-20 z-20 h-[min(148px,22vh)] w-[min(108px,28vw)] max-h-[160px] max-w-[120px] overflow-hidden rounded-[22px] border border-white/35 bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.45),0_0_28px_rgba(255,77,122,0.25)]"
      >
        <div
          ref={localRef}
          id="agora-local"
          className="h-full w-full max-h-full max-w-full overflow-hidden bg-gradient-to-br from-zinc-800 to-rose-900/40 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
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

      {/* Floating circular actions — thumb-reachable, never off-screen */}
      <div className="pointer-events-auto absolute bottom-3 right-3 z-30 flex max-h-[55vh] flex-col items-center gap-2.5 overflow-y-auto">
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
            setSpeakerOn((v) => {
              const next = !v;
              if (!isAi) void setUserSpeaker(next);
              pushToast(next ? "Speaker on" : "Earpiece volume");
              return next;
            });
          }}
          className={`${fab} ${speakerOn ? "" : "opacity-70"}`}
          aria-label={speakerOn ? "Speaker on" : "Speaker off"}
        >
          {speakerOn ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isAi) void switchUserCamera();
          }}
          onDoubleClick={() => {
            if (!isAi) void recoverUserCamera();
          }}
          className={fab}
          aria-label="Flip camera"
          title="Double-tap to recover camera"
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
