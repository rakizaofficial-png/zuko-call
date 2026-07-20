"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Send,
  Star,
  Video,
} from "lucide-react";
import { fetchLiveHosts } from "@/lib/api";
import { requireApiBase } from "@/config/apiConfig";
import {
  hostFromId,
  type DiscoverHost,
} from "@/lib/discoverHosts";
import { openDmWithHost } from "@/lib/dmStore";
import { useApp } from "@/lib/store";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { HostProfileAutoCall } from "@/components/welcome/HostProfileAutoCall";

async function fetchHostProfile(id: string): Promise<{
  name?: string;
  avatarUrl?: string;
  country?: string;
  ratePerMinute?: number;
  isOnline?: boolean;
  isLive?: boolean;
  isOnCall?: boolean;
} | null> {
  try {
    const res = await fetch(
      `${requireApiBase()}/hosts/${encodeURIComponent(id)}/profile`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      host?: {
        name?: string;
        avatarUrl?: string;
        country?: string;
        ratePerMinute?: number;
        isOnline?: boolean;
        isLive?: boolean;
        isOnCall?: boolean;
      };
    };
    return data.host || null;
  } catch {
    return null;
  }
}

export default function HostProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { following, toggleFollow } = useApp();
  const [host, setHost] = useState<DiscoverHost>(() => hostFromId(id));

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [live, profile] = await Promise.all([
          fetchLiveHosts({ readyOnly: false }),
          fetchHostProfile(id),
        ]);
        if (cancelled) return;
        const next = hostFromId(id, live);
        const name = profile?.name || next.name;
        const avatarUrl = pickHostAvatarUrl(
          {
            avatarUrl: profile?.avatarUrl || next.avatarUrl,
          },
          { hostId: next.id, name },
        );
        setHost({
          ...next,
          name,
          avatarUrl,
          country: profile?.country || next.country,
          callRate: profile?.ratePerMinute || next.callRate,
          online: profile?.isOnline ?? next.online,
          live: profile?.isLive ?? next.live,
          onCall: profile?.isOnCall ?? next.onCall,
        });
      } catch {
        if (!cancelled) setHost(hostFromId(id));
      }
    };

    void hydrate();
    const t = setInterval(() => {
      void hydrate();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  const isFollowing = following.includes(host.id);
  const status = host.live
    ? "Live"
    : host.onCall
      ? "Busy"
      : host.online
        ? "Online"
        : "Offline";

  const openChat = () => {
    const tid = openDmWithHost({
      hostId: host.id,
      hostName: host.name,
      hostAvatar: host.avatarUrl,
    });
    router.push(`/messages/${tid}`);
  };

  return (
    <main className="min-h-dvh bg-[#0b0b0f] pb-28 text-white">
      <div className="relative h-[58vh] min-h-[340px] w-full overflow-hidden bg-[#16161c]">
        <HostAvatarImg
          src={host.avatarUrl}
          hostId={host.id}
          name={host.name}
          alt={host.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-[#0b0b0f]" />

        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href="/"
            className="rounded-full bg-black/45 p-2.5 backdrop-blur-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold backdrop-blur-md">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                host.live
                  ? "bg-[#ff3b5c]"
                  : host.onCall
                    ? "bg-[#ff4d4f]"
                    : host.online
                      ? "bg-[#22c55e]"
                      : "bg-white/40"
              }`}
            />
            {status}
          </span>
        </div>
      </div>

      <section className="-mt-16 relative z-10 px-4">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#15151c]/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-1.5 font-display text-2xl font-extrabold">
                <span className="truncate">{host.name}</span>
                <span className="text-lg text-[#ff6b9d]">
                  {host.gender === "male" ? "♂" : "♀"}
                </span>
                {host.verified ? (
                  <BadgeCheck className="h-5 w-5 text-[#4db8ff]" />
                ) : null}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
                <MapPin className="h-3.5 w-3.5" />
                {host.flag} {host.country}
                {host.age ? ` · ${host.age}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleFollow(host.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                isFollowing
                  ? "bg-white/15 text-white"
                  : "bg-[#ff9f1a] text-black"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/5 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45">
                Rate
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#ffd24a]">
                {host.callRate}/min
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45">
                Rating
              </p>
              <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-sm font-bold">
                <Star className="h-3.5 w-3.5 fill-[#ffd24a] text-[#ffd24a]" />
                {host.rating.toFixed(1)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45">
                Fans
              </p>
              <p className="mt-0.5 text-sm font-bold">
                {host.followers.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-white/75">{host.bio}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {host.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/70"
              >
                {t}
              </span>
            ))}
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/70">
              {host.language}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={openChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-[#222]"
          >
            <Send className="h-4 w-4" />
            Message
          </button>
          <Link
            href={
              host.live
                ? `/live/${encodeURIComponent(host.id)}`
                : `/call/${encodeURIComponent(host.id)}?live=1`
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff9f1a] py-3.5 text-sm font-bold text-black"
          >
            <Video className="h-4 w-4" />
            {host.live ? "Watch Live" : "Video Call"}
          </Link>
        </div>
      </section>

      <HostProfileAutoCall host={host} />
    </main>
  );
}
