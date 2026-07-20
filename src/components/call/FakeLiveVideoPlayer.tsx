"use client";

import { useEffect, useRef, useState } from "react";
import type { AiHostRecord } from "@/lib/aiHosts/types";
import { FAKE_CALL_PREVIEW_MS } from "@/lib/welcomePush/mobileFakeCallVideos";

type Phase = "intro" | "loop";

/**
 * Hidden full-screen “live” video layer for mobile fake calls.
 * Intro plays up to 30s, then seamless loop — no controls.
 */
export function FakeLiveVideoPlayer({
  aiHost,
  active,
  muted = false,
  className = "",
}: {
  aiHost: AiHostRecord;
  active: boolean;
  muted?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [src, setSrc] = useState(aiHost.video_url_1);

  useEffect(() => {
    if (!active) return;
    setPhase("intro");
    setSrc(aiHost.video_url_1);
  }, [active, aiHost.host_id, aiHost.video_url_1]);

  useEffect(() => {
    if (!active || phase !== "intro") return;
    const t = setTimeout(() => {
      setPhase("loop");
      setSrc(aiHost.video_url_2 || aiHost.video_url_1);
    }, FAKE_CALL_PREVIEW_MS);
    return () => clearTimeout(t);
  }, [active, phase, aiHost.video_url_1, aiHost.video_url_2]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !active) return;

    el.muted = muted;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.controls = false;
    el.disablePictureInPicture = true;
    el.loop = phase === "loop";

    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        el.muted = true;
        try {
          await el.play();
        } catch {
          /* keep poster */
        }
      }
    };

    void tryPlay();
  }, [active, src, muted, phase]);

  const onEnded = () => {
    if (phase === "intro") {
      setPhase("loop");
      setSrc(aiHost.video_url_2 || aiHost.video_url_1);
    }
  };

  if (!active) return null;

  return (
    <div
      className={`absolute inset-0 z-[1] overflow-hidden bg-black ${className}`}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/25 via-transparent to-black/50" />
      <video
        ref={videoRef}
        key={src}
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        muted={muted}
        loop={phase === "loop"}
        controls={false}
        disablePictureInPicture
        preload="auto"
        onEnded={onEnded}
        controlsList="nodownload noplaybackrate noremoteplayback"
        style={{ background: "#000" }}
      />
      <div className="absolute inset-0 z-[3]" />
    </div>
  );
}
