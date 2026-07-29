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
  nextRingDurationMs,
  pickNextWelcomeCaller,
} from "@/lib/welcomePush/rotation";
import {
  startWelcomeRingTone,
  stopWelcomeRingTone,
} from "@/lib/welcomePush/ringtone";
import { pickRandomStatusLine } from "@/lib/welcomePush/uiCopy";
import { useApp } from "@/lib/store";
import { heartbeatAutoCall } from "@/lib/autoCallApi";

const FIRST_PREVIEW_DELAY_MS = 7_000;
const SECOND_PREVIEW_DELAY_MS = 40_000;
const REPEAT_PREVIEW_DELAY_MS = 60_000;
const PREVIEW_STOP_BALANCE = 80;
const PREVIEW_DISABLED_KEY = "zuko_auto_preview_disabled_v1";

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
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

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
  const phaseRef = useRef<WelcomePushPhase>("IDLE");
  const pickingRef = useRef(false);
  const shownCountRef = useRef(0);
  const acceptedStopRef = useRef(false);
  const permanentlyDisabledRef = useRef(false);

  useEffect(() => {
    permanentlyDisabledRef.current =
      typeof window !== "undefined" &&
      localStorage.getItem(PREVIEW_DISABLED_KEY) === "1";
  }, []);

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
    if (repeatTimer.current) {
      clearTimeout(repeatTimer.current);
      repeatTimer.current = null;
    }
    stopWelcomeRingTone();
  }, []);

  const triggerIncoming = useCallback(async () => {
    if (!opts.enabled) return;
    if (acceptedStopRef.current || permanentlyDisabledRef.current) return;
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    if (phaseRef.current !== "IDLE" && phaseRef.current !== "DONE") return;
    // Autopush when balance is low (≤ threshold) — not only when fully empty.
    if (coinsRef.current >= PREVIEW_STOP_BALANCE) return;
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
      shownCountRef.current += 1;
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
      repeatTimer.current = setTimeout(() => {
        void triggerIncoming();
      }, delayMs);
    },
    [triggerIncoming],
  );

  useEffect(() => {
    if (!opts.enabled) return;
    const onVisible = () => {
      if (
        !document.hidden &&
        (phaseRef.current === "IDLE" || phaseRef.current === "DONE") &&
        !acceptedStopRef.current &&
        !permanentlyDisabledRef.current
      ) {
        scheduleNext(REPEAT_PREVIEW_DELAY_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
      queueMicrotask(() => setPhase("IDLE"));
      return;
    }
    if (!ready) return;
    if (coins >= PREVIEW_STOP_BALANCE) {
      permanentlyDisabledRef.current = true;
      localStorage.setItem(PREVIEW_DISABLED_KEY, "1");
      clearTimers();
      queueMicrotask(() => setPhase("IDLE"));
      return;
    }
    if (permanentlyDisabledRef.current || acceptedStopRef.current) return;
    scheduleNext(
      shownCountRef.current === 0
        ? FIRST_PREVIEW_DELAY_MS
        : shownCountRef.current === 1
          ? SECOND_PREVIEW_DELAY_MS
          : REPEAT_PREVIEW_DELAY_MS,
    );
    return () => {
      clearTimers();
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
    };
  }, [opts.enabled, ready, coins, clearTimers, scheduleNext]);

  useEffect(() => {
    if (!opts.enabled || !ready) return;
    const sendHeartbeat = () => {
      void heartbeatAutoCall({
        coinBalance: coinsRef.current,
        inCall: phaseRef.current === "TEASER_PLAYING",
      }).catch(() => undefined);
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 25_000);
    return () => window.clearInterval(timer);
  }, [opts.enabled, ready, coins]);

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
      scheduleNext(
        shownCountRef.current <= 1
          ? SECOND_PREVIEW_DELAY_MS
          : REPEAT_PREVIEW_DELAY_MS,
      );
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
    queueMicrotask(() => setOfferLeft(WELCOME_PUSH_CONFIG.offerSeconds));
    offerTimer.current = setInterval(() => {
      setOfferLeft((s) => {
        if (s <= 1) {
          if (offerTimer.current) clearInterval(offerTimer.current);
          // Cut call when offer ends without recharge — next ring in 5–9s
          queueMicrotask(() => {
            clearTimers();
            setPhase("IDLE");
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (offerTimer.current) clearInterval(offerTimer.current);
    };
  }, [phase, clearTimers]);

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
    queueMicrotask(() =>
      setPreviewLeft(Math.round(WELCOME_PUSH_CONFIG.teaserCutMs / 1000)),
    );
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
    scheduleNext(
      shownCountRef.current <= 1
        ? SECOND_PREVIEW_DELAY_MS
        : REPEAT_PREVIEW_DELAY_MS,
    );
  }, [scheduleNext]);

  const acceptIncoming = useCallback(() => {
    acceptedStopRef.current = true;
    stopWelcomeRingTone();
    if (ringTimer.current) {
      clearTimeout(ringTimer.current);
      ringTimer.current = null;
    }
    // Real online hosts: navigate to Agora bridge immediately (no spinner / freeze)
    if (host.source === "live" && host.host_id) {
      clearTimers();
      void heartbeatAutoCall({
        coinBalance: coinsRef.current,
        inCall: true,
        acceptedCall: true,
      }).catch(() => undefined);
      setPhase("IDLE");
      router.push(`/call/${encodeURIComponent(host.host_id)}?live=1`);
      return;
    }
    // Demo / simulated hosts: play preview clip once → recharge when it ends
    setPhase("TEASER_PLAYING");
    clearTimers();
    void heartbeatAutoCall({
      coinBalance: coinsRef.current,
      inCall: true,
      acceptedCall: true,
    }).catch(() => undefined);
    // Wide safety net until player reports real duration (or if no video)
    if (teaserTimer.current) clearTimeout(teaserTimer.current);
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserMaxMs);
  }, [clearTimers, host.host_id, host.source, router]);

  const closePaywall = useCallback(() => {
    // Accepted calls stop the auto-preview sequence for this app session.
    clearTimers();
    setPhase("IDLE");
  }, [clearTimers]);

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
