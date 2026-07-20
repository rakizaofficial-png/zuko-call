"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { WelcomePushHost } from "@/lib/welcomePush/config";
import { pickRandomConnectLine } from "@/lib/welcomePush/uiCopy";

/**
 * Hidden immersive teaser player — no controls / scrubber.
 * Loops a mobile portrait clip; parent hard-cuts at 30s into PAYWALL_BOOST.
 */
export function TeaserCallPlayer({
  host,
  onHardCut,
}: {
  host: WelcomePushHost;
  onHardCut?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectLine] = useState(() => pickRandomConnectLine());

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.controls = false;
    el.playsInline = true;
    el.muted = false;
    el.loop = true;
    const play = async () => {
      try {
        await el.play();
      } catch {
        el.muted = true;
        try {
          await el.play();
        } catch {
          onHardCut?.();
        }
      }
    };
    void play();
  }, [onHardCut, host.teaser_video_url]);

  const liveLabel = useMemo(
    () => (host.source === "live" ? "Live · Private" : "Preview · Private"),
    [host.source],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[100] mx-auto w-full max-w-[430px] overflow-hidden bg-black"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <video
        ref={videoRef}
        src={host.teaser_video_url}
        poster={host.avatar}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        loop
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        preload="auto"
      />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/40 via-transparent to-black/70" />
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

      <div className="absolute bottom-10 left-0 right-0 z-10 flex flex-col items-center px-6">
        <motion.div
          className="mb-3 overflow-hidden rounded-full ring-2 ring-cyan/50"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Image
            src={host.avatar}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-cover"
          />
        </motion.div>
        <p className="font-display text-xl font-extrabold text-white">
          {host.name}
        </p>
        <p className="mt-1 text-xs font-semibold text-cyan/80">{connectLine}</p>
        <p className="mt-1 text-[10px] text-white/50">
          {host.flag} {host.country} · {host.durationPreview}
        </p>
      </div>
    </motion.div>
  );
}
