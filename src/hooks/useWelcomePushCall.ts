"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WELCOME_PUSH_CONFIG,
  WELCOME_PUSH_HOST,
  type WelcomePushHost,
  type WelcomePushPhase,
} from "@/lib/welcomePush/config";
import {
  nextLaunchDelayMs,
  nextPostRechargeDelayMs,
  nextRepeatDelayMs,
  nextRingDurationMs,
  pickNextWelcomeCaller,
} from "@/lib/welcomePush/rotation";
import {
  startWelcomeRingTone,
  stopWelcomeRingTone,
} from "@/lib/welcomePush/ringtone";
import { pickRandomStatusLine } from "@/lib/welcomePush/uiCopy";
import { useApp } from "@/lib/store";

/**
 * Lifecycle:
 * IDLE → INCOMING_CALL → Accept →
 *   live host → instant Agora call route (zero-lag)
 *   demo → TEASER (30s free preview) → PAYWALL_BOOST
 *      → recharge OR offer expires / dismiss → call cut (IDLE)
 * Preview length = video length; when the clip ends → PAYWALL_BOOST.
 * Next autopush after paywall / "Recharge later" is 1–2 minutes.
 * Autopush also fires when coins are low (≤ lowCoinThreshold), not only 0.
 */

export function useWelcomePushCall(opts: { enabled: boolean }) {
  const router = useRouter();
  const { coins, ready } = useApp();
  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const [phase, setPhase] = useState<WelcomePushPhase>("IDLE");
  const [host, setHost] = useState<WelcomePushHost>(WELCOME_PUSH_HOST);
  const [statusLine, setStatusLine] = useState("Ringing…");
  const [offerLeft, setOfferLeft] = useState<number>(
    WELCOME_PUSH_CONFIG.offerSeconds,
  );
  const [previewLeft, setPreviewLeft] = useState(30);
  const teaserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSinceRef = useRef<number>(Date.now());
  const phaseRef = useRef<WelcomePushPhase>("IDLE");
  const pickingRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimers = useCallback(() => {
    if (teaserTimer.current) {
      clearTimeout(teaserTimer.current);
      teaserTimer.current = null;
    }
    if (previewTick.current) {
      clearInterval(previewTick.current);
      previewTick.current = null;
    }
    if (offerTimer.current) {
      clearInterval(offerTimer.current);
      offerTimer.current = null;
    }
    if (ringTimer.current) {
      clearTimeout(ringTimer.current);
      ringTimer.current = null;
    }
    stopWelcomeRingTone();
  }, []);

  const triggerIncoming = useCallback(async () => {
    if (!opts.enabled) return;
    if (typeof document !== "undefined" && document.hidden) {
      // Defer while tab hidden — reschedule shortly
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      repeatTimer.current = setTimeout(() => {
        void triggerIncoming();
      }, nextRepeatDelayMs());
      return;
    }
    if (phaseRef.current !== "IDLE" && phaseRef.current !== "DONE") return;
    // Autopush when balance is low (≤ threshold) — not only when fully empty.
    if (coinsRef.current > WELCOME_PUSH_CONFIG.lowCoinThreshold) return;
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      const next = await pickNextWelcomeCaller();
      // Prefer matched pack teaser; only overlay library if pack missing
      if (!next.teaser_video_url) {
        try {
          const { resolveLibraryTeaserUrl } = await import(
            "@/lib/welcomePush/libraryTeaser"
          );
          const teaser = await resolveLibraryTeaserUrl();
          if (teaser) next.teaser_video_url = teaser;
        } catch {
          /* keep host teaser */
        }
      }
      if (!opts.enabled) return;
      if (phaseRef.current !== "IDLE" && phaseRef.current !== "DONE") return;
      setHost(next);
      setStatusLine(pickRandomStatusLine());
      setPhase("INCOMING_CALL");
      startWelcomeRingTone();
    } catch {
      /* stay idle; will retry on next schedule */
    } finally {
      pickingRef.current = false;
    }
  }, [opts.enabled]);

  const scheduleNext = useCallback(
    (delayMs: number) => {
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      idleSinceRef.current = Date.now();
      repeatTimer.current = setTimeout(() => {
        void triggerIncoming();
      }, delayMs);
    },
    [triggerIncoming],
  );

  // Soft inactivity: user activity while IDLE pushes the next ring out
  // so calls feel unexpected after quiet browsing, not mid-tap spam.
  useEffect(() => {
    if (!opts.enabled) return;
    const bump = () => {
      if (phaseRef.current !== "IDLE" && phaseRef.current !== "DONE") return;
      const elapsed = Date.now() - idleSinceRef.current;
      // Only reschedule if we're already past half the window (active browsing)
      if (elapsed < 20_000) return;
      idleSinceRef.current = Date.now();
      scheduleNext(nextRepeatDelayMs());
    };
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "touchstart",
      "keydown",
      "scroll",
    ];
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true });
    }
    const onVis = () => {
      if (document.hidden) return;
      if (phaseRef.current === "IDLE" || phaseRef.current === "DONE") {
        scheduleNext(nextRepeatDelayMs());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, bump);
      }
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [opts.enabled, scheduleNext]);

  // Auto welcome-call arming.
  //  • Only arm once the live wallet balance is known (`ready`) so we never
  //    ring during the pre-sync window when coins default to 0.
  //  • Fire when coins are low (≤ lowCoinThreshold). Healthy balance cancels.
  //  • First / repeat gap is 1–2 minutes.
  useEffect(() => {
    if (!opts.enabled) {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      setPhase("IDLE");
      return;
    }
    if (!ready) return;
    if (coins > WELCOME_PUSH_CONFIG.lowCoinThreshold) {
      if (repeatTimer.current) {
        clearTimeout(repeatTimer.current);
        repeatTimer.current = null;
      }
      return;
    }
    scheduleNext(nextLaunchDelayMs());
    return () => {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
    };
  }, [opts.enabled, ready, coins, clearTimers, scheduleNext]);

  // Ringtone + auto-dismiss
  useEffect(() => {
    if (phase !== "INCOMING_CALL") {
      stopWelcomeRingTone();
      if (ringTimer.current) {
        clearTimeout(ringTimer.current);
        ringTimer.current = null;
      }
      return;
    }
    startWelcomeRingTone();
    const ringMs = nextRingDurationMs();
    ringTimer.current = setTimeout(() => {
      stopWelcomeRingTone();
      setPhase("IDLE");
      scheduleNext(nextRepeatDelayMs());
    }, ringMs);
    return () => {
      stopWelcomeRingTone();
      if (ringTimer.current) {
        clearTimeout(ringTimer.current);
        ringTimer.current = null;
      }
    };
  }, [phase, scheduleNext]);

  // Paywall FOMO countdown — expire = call cut
  useEffect(() => {
    if (phase !== "PAYWALL_BOOST") return;
    setOfferLeft(WELCOME_PUSH_CONFIG.offerSeconds);
    offerTimer.current = setInterval(() => {
      setOfferLeft((s) => {
        if (s <= 1) {
          if (offerTimer.current) clearInterval(offerTimer.current);
          // Cut call when offer ends without recharge — next ring in 5–9s
          queueMicrotask(() => {
            clearTimers();
            setPhase("IDLE");
            scheduleNext(nextPostRechargeDelayMs());
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (offerTimer.current) clearInterval(offerTimer.current);
    };
  }, [phase, clearTimers, scheduleNext]);

  // Preview countdown — driven by video duration when known; fallback tick only
  useEffect(() => {
    if (phase !== "TEASER_PLAYING") {
      if (previewTick.current) {
        clearInterval(previewTick.current);
        previewTick.current = null;
      }
      return;
    }
    // Seed with fallback until the player reports real clip length
    setPreviewLeft(Math.round(WELCOME_PUSH_CONFIG.teaserCutMs / 1000));
    previewTick.current = setInterval(() => {
      setPreviewLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (previewTick.current) {
        clearInterval(previewTick.current);
        previewTick.current = null;
      }
    };
  }, [phase]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const rejectIncoming = useCallback(() => {
    stopWelcomeRingTone();
    setPhase("IDLE");
    scheduleNext(nextRepeatDelayMs());
  }, [scheduleNext]);

  const acceptIncoming = useCallback(() => {
    stopWelcomeRingTone();
    if (ringTimer.current) {
      clearTimeout(ringTimer.current);
      ringTimer.current = null;
    }
    // Real online hosts: navigate to Agora bridge immediately (no spinner / freeze)
    if (host.source === "live" && host.host_id) {
      clearTimers();
      setPhase("IDLE");
      router.push(`/call/${encodeURIComponent(host.host_id)}?live=1`);
      return;
    }
    // Demo / simulated hosts: play preview clip once → recharge when it ends
    setPhase("TEASER_PLAYING");
    // Wide safety net until player reports real duration (or if no video)
    if (teaserTimer.current) clearTimeout(teaserTimer.current);
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserMaxMs);
  }, [clearTimers, host.host_id, host.source, router]);

  const closePaywall = useCallback(() => {
    // Dismiss without recharge ("Recharge later") → cut call; next in 1–2 min
    clearTimers();
    setPhase("IDLE");
    scheduleNext(nextPostRechargeDelayMs());
  }, [clearTimers, scheduleNext]);

  /** Video finished (or failed) → cut call + open recharge */
  const hardDisconnectTeaser = useCallback(() => {
    if (teaserTimer.current) {
      clearTimeout(teaserTimer.current);
      teaserTimer.current = null;
    }
    setPhase("PAYWALL_BOOST");
  }, []);

  /** Align safety timer + countdown to the natural clip length */
  const onTeaserDuration = useCallback((seconds: number) => {
    const secs = Math.max(1, Math.ceil(seconds));
    setPreviewLeft(secs);
    if (teaserTimer.current) clearTimeout(teaserTimer.current);
    // Small buffer past natural end so `ended` wins; still cuts if ended misses
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, secs * 1000 + 750);
  }, []);

  return {
    phase,
    host,
    statusLine,
    offerLeft,
    previewLeft,
    acceptIncoming,
    rejectIncoming,
    closePaywall,
    hardDisconnectTeaser,
    onTeaserDuration,
  };
}
