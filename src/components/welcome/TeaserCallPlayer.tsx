"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { WelcomePushHost } from "@/lib/welcomePush/config";
import { pickRandomConnectLine } from "@/lib/welcomePush/uiCopy";
import { pickPushCallVideo } from "@/lib/welcomePush/pushCallVideos";

/**
 * Free preview after Accept only — plays the clip once.
 * When the video ends (or fails), parent cuts the call and opens recharge.
 */
export function TeaserCallPlayer({
  host,
  previewLeft: previewLeftProp,
  onHardCut,
  onDuration,
}: {
  host: WelcomePushHost;
  previewLeft?: number;
  /** Fired when the preview clip finishes (or cannot play) */
  onHardCut?: () => void;
  /** Reports natural video length in seconds once known */
  onDuration?: (seconds: number) => void;
}) {
  const [connectLine] = useState(() => pickRandomConnectLine());
  const [remaining, setRemaining] = useState(previewLeftProp ?? 0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);
  const onHardCutRef = useRef(onHardCut);
  const onDurationRef = useRef(onDuration);
  onHardCutRef.current = onHardCut;
  onDurationRef.current = onDuration;

  const teaserVideo =
    pickPushCallVideo(host.host_id || host.name) || host.teaser_video_url || "";

  const liveLabel = useMemo(
    () => (host.source === "live" ? "Live · Preview" : "Free preview"),
    [host.source],
  );

  const finish = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    onHardCutRef.current?.();
  };

  // Play once after Accept (this screen only mounts post-answer).
  // Prefer unmuted — Accept is a user gesture — fall back to muted autoplay.
  useEffect(() => {
    endedRef.current = false;
    const el = videoRef.current;
    if (!el || !teaserVideo) {
      // No clip → parent fallback timer still applies; nothing to bind
      return;
    }

    el.loop = false;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");

    const onMeta = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      if (dur > 0) {
        const secs = Math.max(1, Math.ceil(dur));
        setRemaining(secs);
        onDurationRef.current?.(secs);
      }
    };

    const onTime = () => {
      if (!Number.isFinite(el.duration) || el.duration <= 0) return;
      setRemaining(Math.max(0, Math.ceil(el.duration - el.currentTime)));
    };

    const onEnded = () => finish();
    const onError = () => finish();

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    const tryPlay = async () => {
      el.muted = false;
      try {
        await el.play();
      } catch {
        el.muted = true;
        try {
          await el.play();
        } catch {
          finish();
        }
      }
    };
    void tryPlay();

    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish closes over stable refs
  }, [teaserVideo]);

  const displayLeft =
    remaining > 0 ? remaining : Math.max(0, previewLeftProp ?? 0);

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
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
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
        className="absolute left-4 top-3 z-10 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">
          {liveLabel}
        </span>
      </motion.div>

      <motion.div
        className="absolute right-4 top-3 z-10 rounded-full border border-gold/40 bg-black/50 px-3 py-1.5 backdrop-blur"
        key={displayLeft}
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
      >
        <span className="font-display text-sm font-extrabold tabular-nums text-gold">
          {String(displayLeft).padStart(2, "0")}s
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
          Free preview · call ends when video ends · recharge to continue
        </p>
      </div>
    </motion.div>
  );
}
