"use client";

import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { IncomingCallLure } from "@/components/welcome/IncomingCallLure";
import { TeaserCallPlayer } from "@/components/welcome/TeaserCallPlayer";
import { RechargePaywallSheet } from "@/components/welcome/RechargePaywallSheet";
import { useWelcomePushCall } from "@/hooks/useWelcomePushCall";
import { ensurePremiumFemalePool } from "@/lib/welcomePush/premiumFemaleGenerator";

/**
 * Simulated premium female incoming-call engine.
 * Fires every 1–2 min while browsing → video ring → answer → recharge if broke.
 */
export function WelcomePushEngine() {
  const pathname = usePathname();
  const onDashboard =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/call" ||
    pathname === "/match";

  useEffect(() => {
    if (!onDashboard) return;
    ensurePremiumFemalePool();
  }, [onDashboard]);

  const {
    phase,
    host,
    statusLine,
    offerLeft,
    acceptIncoming,
    rejectIncoming,
    closePaywall,
    hardDisconnectTeaser,
  } = useWelcomePushCall({ enabled: onDashboard });

  if (phase === "IDLE") return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === "INCOMING_CALL" && (
          <IncomingCallLure
            key={`incoming-${host.host_id}-${host.messageId}`}
            host={host}
            statusLine={statusLine}
            onAccept={acceptIncoming}
            onReject={rejectIncoming}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "TEASER_PLAYING" && (
          <TeaserCallPlayer
            key={`teaser-${host.host_id}`}
            host={host}
            onHardCut={hardDisconnectTeaser}
          />
        )}
      </AnimatePresence>

      <RechargePaywallSheet
        open={phase === "PAYWALL_BOOST"}
        host={host}
        offerLeft={offerLeft}
        onClose={closePaywall}
      />
    </>
  );
}
