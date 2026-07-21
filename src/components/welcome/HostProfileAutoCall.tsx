"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { IncomingCallLure } from "@/components/welcome/IncomingCallLure";
import { TeaserCallPlayer } from "@/components/welcome/TeaserCallPlayer";
import { RechargePaywallSheet } from "@/components/welcome/RechargePaywallSheet";
import { discoverHostToWelcomePush } from "@/lib/welcomePush/hostToWelcomePush";
import {
  WELCOME_PUSH_CONFIG,
  type WelcomePushHost,
  type WelcomePushPhase,
} from "@/lib/welcomePush/config";
import {
  startWelcomeRingTone,
  stopWelcomeRingTone,
} from "@/lib/welcomePush/ringtone";
import { pickRandomStatusLine } from "@/lib/welcomePush/uiCopy";
import { nextRingDurationMs } from "@/lib/welcomePush/rotation";
import type { DiscoverHost } from "@/lib/discoverHosts";

const PROFILE_RING_DELAY_MS = 2_400;

/**
 * Host profile auto-call: Accept → instant Agora bridge (zero-lag).
 * Demo fallback keeps 30s preview → recharge if needed.
 */
export function HostProfileAutoCall({ host }: { host: DiscoverHost }) {
  const router = useRouter();
  const [phase, setPhase] = useState<WelcomePushPhase>("IDLE");
  const [caller, setCaller] = useState<WelcomePushHost | null>(null);
  const [statusLine, setStatusLine] = useState("Ringing…");
  const [offerLeft, setOfferLeft] = useState<number>(
    WELCOME_PUSH_CONFIG.offerSeconds,
  );
  const [previewLeft, setPreviewLeft] = useState<number>(30);
  const firedForId = useRef<string | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teaserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hostRef = useRef(host);
  hostRef.current = host;

  const cutCall = () => {
    stopWelcomeRingTone();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (teaserTimer.current) clearTimeout(teaserTimer.current);
    if (previewTick.current) clearInterval(previewTick.current);
    if (offerTimer.current) clearInterval(offerTimer.current);
    setPhase("IDLE");
  };

  useEffect(() => {
    if (!host?.id) return;
    if (firedForId.current === host.id) return;
    if (host.name === "Host") return;

    const hostId = host.id;
    const t = setTimeout(() => {
      if (firedForId.current === hostId) return;
      firedForId.current = hostId;
      const next = discoverHostToWelcomePush(hostRef.current);
      setCaller(next);
      setStatusLine(pickRandomStatusLine());
      setPhase("INCOMING_CALL");
      startWelcomeRingTone();
    }, PROFILE_RING_DELAY_MS);

    return () => clearTimeout(t);
  }, [host.id, host.name]);

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
    ringTimer.current = setTimeout(() => {
      stopWelcomeRingTone();
      setPhase("IDLE");
    }, nextRingDurationMs());
    return () => {
      stopWelcomeRingTone();
      if (ringTimer.current) clearTimeout(ringTimer.current);
    };
  }, [phase]);

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
      if (previewTick.current) clearInterval(previewTick.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "PAYWALL_BOOST") return;
    setOfferLeft(WELCOME_PUSH_CONFIG.offerSeconds);
    offerTimer.current = setInterval(() => {
      setOfferLeft((s) => {
        if (s <= 1) {
          if (offerTimer.current) clearInterval(offerTimer.current);
          queueMicrotask(() => cutCall());
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (offerTimer.current) clearInterval(offerTimer.current);
    };
  }, [phase]);

  useEffect(
    () => () => {
      stopWelcomeRingTone();
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (teaserTimer.current) clearTimeout(teaserTimer.current);
      if (previewTick.current) clearInterval(previewTick.current);
      if (offerTimer.current) clearInterval(offerTimer.current);
    },
    [],
  );

  if (phase === "IDLE" || !caller) return null;

  const reject = () => {
    cutCall();
  };

  const accept = () => {
    stopWelcomeRingTone();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    // Profile hosts are real — join Agora immediately (no loading gate)
    const hid = caller?.host_id || host.id;
    if (hid) {
      setPhase("IDLE");
      router.push(`/call/${encodeURIComponent(hid)}?live=1`);
      return;
    }
    setPhase("TEASER_PLAYING");
    // Wide safety net until player reports real duration
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserMaxMs);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === "INCOMING_CALL" && (
          <IncomingCallLure
            key={`profile-incoming-${caller.host_id}`}
            host={caller}
            statusLine={statusLine}
            onAccept={accept}
            onReject={reject}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "TEASER_PLAYING" && (
          <TeaserCallPlayer
            key={`profile-teaser-${caller.host_id}`}
            host={caller}
            previewLeft={previewLeft}
            onHardCut={() => {
              if (teaserTimer.current) clearTimeout(teaserTimer.current);
              setPhase("PAYWALL_BOOST");
            }}
            onDuration={(seconds) => {
              const secs = Math.max(1, Math.ceil(seconds));
              setPreviewLeft(secs);
              if (teaserTimer.current) clearTimeout(teaserTimer.current);
              teaserTimer.current = setTimeout(() => {
                setPhase("PAYWALL_BOOST");
              }, secs * 1000 + 750);
            }}
          />
        )}
      </AnimatePresence>

      <RechargePaywallSheet
        open={phase === "PAYWALL_BOOST"}
        host={caller}
        offerLeft={offerLeft}
        onClose={cutCall}
      />
    </>
  );
}
