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
 */
/** Ring shortly after launch/initialization once we know the user is broke. */
const STARTUP_CALL_DELAY_MS = 1500;

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
    // STRICT BUSINESS RULE: the automatic welcome / AI-host call fires ONLY
    // when the user's coins are fully exhausted. If they still hold any
    // balance (> 0) we NEVER ring — they should be spending, not lured.
    if (coinsRef.current > 0) return;
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
      if (coinsRef.current > 0) return;
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
  //  • Strict rule: fire ONLY when coins are exhausted (<= 0). A user with a
  //    balance has any pending auto-call cancelled.
  //  • When broke, ring shortly after launch/initialization so the trigger
  //    fires on app open (same on the mobile WebView as on web).
  useEffect(() => {
    if (!opts.enabled) {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      setPhase("IDLE");
      return;
    }
    if (!ready) return;
    if (coins > 0) {
      if (repeatTimer.current) {
        clearTimeout(repeatTimer.current);
        repeatTimer.current = null;
      }
      return;
    }
    scheduleNext(STARTUP_CALL_DELAY_MS);
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
          // Cut call when offer ends without recharge
          queueMicrotask(() => {
            clearTimers();
            setPhase("IDLE");
            scheduleNext(nextRepeatDelayMs());
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

  // 30s preview tick for UI countdown
  useEffect(() => {
    if (phase !== "TEASER_PLAYING") {
      if (previewTick.current) {
        clearInterval(previewTick.current);
        previewTick.current = null;
      }
      return;
    }
    const total = Math.round(WELCOME_PUSH_CONFIG.teaserCutMs / 1000);
    setPreviewLeft(total);
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
    // Demo / simulated hosts: 30s free preview → recharge popup
    setPhase("TEASER_PLAYING");
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserCutMs);
  }, [clearTimers, host.host_id, host.source, router]);

  const closePaywall = useCallback(() => {
    // Dismiss without recharge → cut call
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
    previewLeft,
    acceptIncoming,
    rejectIncoming,
    closePaywall,
    hardDisconnectTeaser,
  };
}
