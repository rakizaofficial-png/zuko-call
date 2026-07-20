"use client";

import Image from "next/image";
import type { AiHostRecord } from "@/lib/aiHosts/types";

/**
 * Automated AI call backdrop — host profile photo only (no pre-recorded video).
 */
export function FakeLiveVideoPlayer({
  aiHost,
  active,
  className = "",
}: {
  aiHost: AiHostRecord;
  active: boolean;
  muted?: boolean;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div
      className={`absolute inset-0 z-[1] overflow-hidden bg-black ${className}`}
      aria-hidden
    >
      <Image
        src={aiHost.avatar}
        alt=""
        fill
        priority
        className="object-cover object-top"
        sizes="100vw"
      />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/30 via-transparent to-black/55" />
      <div className="absolute inset-0 z-[3]" />
    </div>
  );
}
