"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent } from "react";
import { motion } from "framer-motion";
import { Send, Video } from "lucide-react";
import type { DiscoverHost } from "@/lib/discoverHosts";
import { openDmWithHost } from "@/lib/dmStore";

type Mode = "call" | "watch";

function statusLabel(host: DiscoverHost, mode: Mode) {
  if (mode === "watch" || host.live) return { text: "Live", tone: "live" as const };
  if (host.onCall) return { text: "Busy", tone: "busy" as const };
  if (host.online) return { text: "Online", tone: "online" as const };
  return { text: "Offline", tone: "off" as const };
}

/** Modern portrait card — Online/Busy, name, gender, country, rate, chat + video */
export function HostGridCard({
  host,
  mode,
  index = 0,
}: {
  host: DiscoverHost;
  mode: Mode;
  index?: number;
}) {
  const router = useRouter();
  const status = statusLabel(host, mode);
  const busy = mode === "call" && host.onCall;
  const profileHref = `/host/${encodeURIComponent(host.id)}`;
  const callHref =
    mode === "watch" || host.live
      ? `/live/${encodeURIComponent(host.id)}`
      : `/call/${encodeURIComponent(host.id)}${host.source === "live" ? "?live=1" : ""}`;

  const openChat = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tid = openDmWithHost({
      hostId: host.id,
      hostName: host.name,
      hostAvatar: host.avatarUrl,
    });
    router.push(`/messages/${tid}`);
  };

  const openCall = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    router.push(callHref);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-[1.35rem] bg-[#1a1a1f] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <Link href={profileHref} className="relative block aspect-[3/4] w-full">
        <Image
          src={host.avatarUrl}
          alt={host.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 430px) 50vw, 200px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/25" />

        {/* Status */}
        <div className="absolute left-2 top-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md ${
              status.tone === "live"
                ? "bg-black/55"
                : status.tone === "busy"
                  ? "bg-black/55"
                  : "bg-black/55"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status.tone === "live"
                  ? "bg-[#ff3b5c]"
                  : status.tone === "busy"
                    ? "bg-[#ff4d4f]"
                    : status.tone === "online"
                      ? "bg-[#22c55e]"
                      : "bg-white/40"
              }`}
            />
            {status.text}
          </span>
        </div>

        {/* Info */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 pr-[4.5rem]">
          <p className="flex items-center gap-1 truncate font-display text-[13px] font-extrabold text-white">
            <span className="truncate">{host.name}</span>
            <span className="shrink-0 text-[12px] text-[#ff6b9d]" aria-hidden>
              {host.gender === "male" ? "♂" : "♀"}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-white/80">
            <span>{host.flag}</span>
            <span className="truncate">{host.country}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#ffd24a]">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ffd24a] text-[8px] text-black">
              ¢
            </span>
            {host.callRate} /min
          </p>
        </div>
      </Link>

      {/* Action buttons */}
      <div className="pointer-events-auto absolute bottom-2.5 right-2.5 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={openChat}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md"
          aria-label={`Message ${host.name}`}
        >
          <Send className="h-4 w-4 text-[#555]" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={openCall}
          disabled={busy}
          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md ${
            busy
              ? "bg-white/30"
              : mode === "watch" || host.live
                ? "bg-[#ff3b5c]"
                : "bg-[#ff9f1a]"
          }`}
          aria-label={
            mode === "watch" || host.live
              ? `Watch ${host.name}`
              : `Call ${host.name}`
          }
        >
          <Video className="h-4 w-4 text-white" strokeWidth={2.4} />
        </button>
      </div>
    </motion.article>
  );
}

export function HostGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] animate-pulse rounded-[1.35rem] bg-ink-3"
        />
      ))}
    </div>
  );
}

/** Horizontal compact card (home rails) */
export function PremiumHostCard({
  host,
  compact,
}: {
  host: DiscoverHost;
  compact?: boolean;
  mode?: Mode;
}) {
  if (compact) {
    return (
      <Link
        href={`/host/${encodeURIComponent(host.id)}`}
        className="relative flex w-[148px] shrink-0 flex-col overflow-hidden rounded-2xl bg-ink-2"
      >
        <div className="relative h-[168px] w-full">
          <Image
            src={host.avatarUrl}
            alt={host.name}
            fill
            className="object-cover"
            sizes="148px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
          {(host.online || host.live) && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
              <span
                className={`h-1.5 w-1.5 rounded-full ${host.live ? "bg-coral" : "bg-[#22c55e]"}`}
              />
              {host.live ? "Live" : "Online"}
            </span>
          )}
          <div className="absolute bottom-2 left-2 right-2">
            <p className="font-display text-sm font-bold text-sand">{host.name}</p>
            <p className="text-[10px] text-muted">
              {host.flag} {host.country} · {host.callRate}/min
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return <HostGridCard host={host} mode="call" />;
}
