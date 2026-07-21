"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { WelcomePushHost } from "@/lib/welcomePush/config";
import { pickRandomConnectLine } from "@/lib/welcomePush/uiCopy";
import { pickPushCallVideo } from "@/lib/welcomePush/pushCallVideos";

/**
 * 30s free preview — host profile only, then parent opens recharge / cuts call.
 */
export function TeaserCallPlayer({
  host,
  previewLeft = 30,
}: {
  host: WelcomePushHost;
  previewLeft?: number;
  onHardCut?: () => void;
}) {
  const [connectLine] = useState(() => pickRandomConnectLine());
  const videoRef = useRef<HTMLVideoElement>(null);
  // Prefer a bundled provided clip so the video always plays inside the call
  // form on mobile; fall back to the host's own teaser URL.
  const teaserVideo =
    pickPushCallVideo(host.host_id || host.name) || host.teaser_video_url || "";

  const liveLabel = useMemo(
    () => (host.source === "live" ? "Live · Preview" : "Free preview"),
    [host.source],
  );

  // Autoplay the teaser video inside the call form (muted + inline is required
  // for mobile/WebView autoplay to succeed).
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !teaserVideo) return;
    el.muted = true;
    el.playsInline = true;
    el.loop = true;
    void el.play().catch(() => undefined);
  }, [teaserVideo]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] mx-auto w-full max-w-[430px] overflow-hidden bg-black"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {teaserVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={teaserVideo}
          poster={host.avatar}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
        />
      ) : (
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1.12 }}
          transition={{
            duration: 18,
            ease: "linear",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          <Image
            src={host.avatar}
            alt=""
            fill
            priority
            className="object-cover object-top"
            sizes="430px"
          />
        </motion.div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/45 via-transparent to-black/75" />
      <div className="absolute inset-0 z-[3]" />

      <motion.div
        className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">
          {liveLabel}
        </span>
      </motion.div>

      <motion.div
        className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 rounded-full border border-gold/40 bg-black/50 px-3 py-1.5 backdrop-blur"
        key={previewLeft}
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
      >
        <span className="font-display text-sm font-extrabold tabular-nums text-gold">
          {String(previewLeft).padStart(2, "0")}s
        </span>
      </motion.div>

      <div className="absolute bottom-10 left-0 right-0 z-10 flex flex-col items-center px-6">
        <motion.div
          className="mb-3 overflow-hidden rounded-full ring-2 ring-cyan/50"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Image
            src={host.avatar}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 object-cover object-top"
          />
        </motion.div>
        <p className="font-display text-xl font-extrabold text-white">
          {host.name}
        </p>
        <p className="mt-1 text-xs font-semibold text-cyan/80">{connectLine}</p>
        <p className="mt-2 text-center text-[11px] font-semibold text-white/60">
          Free preview · recharge after {previewLeft}s to keep talking
        </p>
      </div>
    </motion.div>
  );
}
