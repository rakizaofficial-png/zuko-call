"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WELCOME_PUSH_CONFIG,
  WELCOME_PUSH_HOST,
  type WelcomePushHost,
  type WelcomePushPhase,
} from "@/lib/welcomePush/config";
import {
  nextLaunchDelayMs,
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
 * IDLE → (1–2 min browse/inactivity) → INCOMING_CALL (ringtone + video bg)
 *      → Accept + 0 coins → PAYWALL (blurred call) immediately
 *      → Accept + coins → TEASER → PAYWALL → IDLE
 *      → Reject / timeout → IDLE (schedule next 1–2 min)
 */
export function useWelcomePushCall(opts: { enabled: boolean }) {
  const { coins } = useApp();
  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const [phase, setPhase] = useState<WelcomePushPhase>("IDLE");
  const [host, setHost] = useState<WelcomePushHost>(WELCOME_PUSH_HOST);
  const [statusLine, setStatusLine] = useState("Ringing…");
  const [offerLeft, setOfferLeft] = useState<number>(
    WELCOME_PUSH_CONFIG.offerSeconds,
  );
  const teaserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // First call after 1–2 min on dashboard + recurring
  useEffect(() => {
    if (!opts.enabled) {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      setPhase("IDLE");
      return;
    }
    scheduleNext(nextLaunchDelayMs());
    return () => {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
    };
  }, [opts.enabled, clearTimers, scheduleNext]);

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

  // Paywall FOMO countdown
  useEffect(() => {
    if (phase !== "PAYWALL_BOOST") return;
    setOfferLeft(WELCOME_PUSH_CONFIG.offerSeconds);
    offerTimer.current = setInterval(() => {
      setOfferLeft((s) => {
        if (s <= 1) {
          if (offerTimer.current) clearInterval(offerTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (offerTimer.current) clearInterval(offerTimer.current);
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
    // Monetization hook: zero balance → recharge immediately (blurred call)
    if (coinsRef.current <= 0) {
      setPhase("PAYWALL_BOOST");
      return;
    }
    setPhase("TEASER_PLAYING");
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserCutMs);
  }, []);

  const closePaywall = useCallback(() => {
    clearTimers();
    setPhase("IDLE");
    scheduleNext(nextRepeatDelayMs());
  }, [clearTimers, scheduleNext]);

  const hardDisconnectTeaser = useCallback(() => {
    if (teaserTimer.current) clearTimeout(teaserTimer.current);
    setPhase("PAYWALL_BOOST");
  }, []);

  return {
    phase,
    host,
    statusLine,
    offerLeft,
    acceptIncoming,
    rejectIncoming,
    closePaywall,
    hardDisconnectTeaser,
  };
}
