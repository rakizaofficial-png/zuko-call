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
 * Fires while browsing home/call/match → photo ring (no bg video) → Accept →
 * play preview clip once → when video ends, cut call + recharge popup.
 * Next autopush after paywall / "Recharge later" is 1–2 minutes.
 * Host profile pages use HostProfileAutoCall separately (call from that host).
 */
export function WelcomePushEngine() {
  const pathname = usePathname();
  const onDashboard =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/call" ||
    pathname === "/match" ||
    pathname === "/live" ||
    pathname === "/party";

  // Pause global auto-call while viewing a specific host profile
  // (profile has its own HostProfileAutoCall from that host)
  const onHostProfile = pathname.startsWith("/host/");
  const enabled = onDashboard && !onHostProfile;

  useEffect(() => {
    if (!enabled) return;
    ensurePremiumFemalePool();
  }, [enabled]);

  const {
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
  } = useWelcomePushCall({ enabled });

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
            previewLeft={previewLeft}
            onHardCut={hardDisconnectTeaser}
            onDuration={onTeaserDuration}
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
