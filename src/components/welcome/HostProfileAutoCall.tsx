"use client";

import { useEffect, useRef, useState } from "react";
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
import { useApp } from "@/lib/store";
import type { DiscoverHost } from "@/lib/discoverHosts";

const PROFILE_RING_DELAY_MS = 2_400;

/**
 * When the user opens a host profile, auto-fire an incoming call
 * from that host after a short delay (adult glam pack + host DP).
 */
export function HostProfileAutoCall({ host }: { host: DiscoverHost }) {
  const { coins } = useApp();
  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const [phase, setPhase] = useState<WelcomePushPhase>("IDLE");
  const [caller, setCaller] = useState<WelcomePushHost | null>(null);
  const [statusLine, setStatusLine] = useState("Ringing…");
  const [offerLeft, setOfferLeft] = useState(45);
  const firedForId = useRef<string | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teaserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    if (!host?.id) return;
    if (firedForId.current === host.id) return;
    // Wait until profile hydrated (avoid "Host" + empty DP)
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

  useEffect(
    () => () => {
      stopWelcomeRingTone();
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (teaserTimer.current) clearTimeout(teaserTimer.current);
      if (offerTimer.current) clearInterval(offerTimer.current);
    },
    [],
  );

  if (phase === "IDLE" || !caller) return null;

  const reject = () => {
    stopWelcomeRingTone();
    setPhase("IDLE");
  };

  const accept = () => {
    stopWelcomeRingTone();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (coinsRef.current <= 0) {
      setPhase("PAYWALL_BOOST");
      return;
    }
    setPhase("TEASER_PLAYING");
    teaserTimer.current = setTimeout(() => {
      setPhase("PAYWALL_BOOST");
    }, WELCOME_PUSH_CONFIG.teaserCutMs);
  };

  const closePaywall = () => setPhase("IDLE");

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
            onHardCut={() => {
              if (teaserTimer.current) clearTimeout(teaserTimer.current);
              setPhase("PAYWALL_BOOST");
            }}
          />
        )}
      </AnimatePresence>

      <RechargePaywallSheet
        open={phase === "PAYWALL_BOOST"}
        host={caller}
        offerLeft={offerLeft}
        onClose={closePaywall}
      />
    </>
  );
}
