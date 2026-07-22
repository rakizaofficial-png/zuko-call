"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Flag,
  Heart,
  MapPin,
  Phone,
  Send,
  Share2,
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
import {
  blockHost,
  isFavorite,
  markHostViewed,
  reportHost,
  toggleFavorite,
} from "@/lib/socialLists";
import { getAuthHeaders } from "@/lib/authSession";
import { getDeviceUserId } from "@/lib/walletApi";

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
  const { following, toggleFollow, pushToast } = useApp();
  const [host, setHost] = useState<DiscoverHost>(() => hostFromId(id));
  const [fav, setFav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const totalCalls = useMemo(
    () => 120 + Math.floor(host.followers / 18),
    [host.followers],
  );
  const reviews = useMemo(
    () => [
      {
        id: "r1",
        name: "Ayesha",
        text: "Crystal clear HD call — loved the vibe.",
        stars: 5,
      },
      {
        id: "r2",
        name: "Omar",
        text: "Friendly host, great for a quick chat.",
        stars: 4,
      },
    ],
    [],
  );

  useEffect(() => {
    setFav(isFavorite(id));
    markHostViewed(id);
  }, [id]);

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

  const onFavorite = () => {
    const next = toggleFavorite(host.id);
    setFav(next);
    pushToast(next ? "Added to favorites" : "Removed from favorites");
  };

  const onShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/host/${encodeURIComponent(host.id)}`
        : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${host.name} on Zuko`,
          text: `Call ${host.name} on Zuko`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Profile link copied");
    } catch {
      pushToast("Could not share");
    }
  };

  const onReport = () => {
    setMenuOpen(false);
    const report = reportHost(host.id, "User report from host profile");
    void (async () => {
      try {
        await fetch(`${requireApiBase()}/support/tickets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": getDeviceUserId(),
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            category: "report",
            subject: `Report host ${host.name}`,
            body: report.reason,
            hostId: host.id,
            reportId: report.id,
          }),
        });
      } catch {
        /* local report retained */
      }
    })();
    pushToast("Report submitted — our team will review");
    router.push("/support");
  };

  const onBlock = () => {
    blockHost(host.id);
    setMenuOpen(false);
    pushToast("Host blocked on this device");
    router.push("/");
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#0b0b0f] pb-28 text-white">
      <div className="relative h-[min(58vh,420px)] min-h-[280px] w-full max-w-[100vw] overflow-hidden bg-[#16161c]">
        <HostAvatarImg
          src={host.avatarUrl}
          hostId={host.id}
          name={host.name}
          alt={host.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-[#0b0b0f]" />

        <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href="/"
            className="rounded-full bg-black/45 p-2.5 backdrop-blur-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={onFavorite}
              className="rounded-full bg-black/45 p-2.5 backdrop-blur-md"
              aria-label="Favorite"
            >
              <Heart
                className={`h-5 w-5 ${fav ? "fill-[#ff2a7a] text-[#ff2a7a]" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => void onShare()}
              className="rounded-full bg-black/45 p-2.5 backdrop-blur-md"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full bg-black/45 px-2.5 py-2 text-xs font-bold backdrop-blur-md"
            >
              More
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute right-3 top-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] z-20 w-44 overflow-hidden rounded-2xl border border-white/15 bg-[#15151c]/95 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              onClick={onReport}
              className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm"
            >
              <Flag className="h-4 w-4 text-amber-300" />
              Report
            </button>
            <button
              type="button"
              onClick={onBlock}
              className="flex w-full items-center gap-2 border-t border-white/10 px-3.5 py-3 text-left text-sm text-rose-300"
            >
              <Ban className="h-4 w-4" />
              Block
            </button>
          </div>
        ) : null}
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
              className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                isFollowing
                  ? "bg-white/15 text-white"
                  : "bg-[#ff9f1a] text-black"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Call price" value={`${host.callRate}/min`} gold />
            <Stat
              label="Rating"
              value={
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-[#ffd24a] text-[#ffd24a]" />
                  {host.rating.toFixed(1)}
                </span>
              }
            />
            <Stat label="Total calls" value={totalCalls.toLocaleString()} />
            <Stat
              label="Fans"
              value={host.followers.toLocaleString()}
            />
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

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#15151c]/90 p-4">
          <h2 className="font-display text-sm font-bold">Reviews</h2>
          <ul className="mt-3 space-y-2.5">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white/5 px-3 py-2.5">
                <p className="flex items-center justify-between text-xs font-bold">
                  <span>{r.name}</span>
                  <span className="text-[#ffd24a]">{"★".repeat(r.stars)}</span>
                </p>
                <p className="mt-1 text-[11px] text-white/65">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-3 pb-2">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={openChat}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-[#222]"
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
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#ff9f1a] py-3.5 text-sm font-bold text-black"
            >
              <Video className="h-4 w-4" />
              {host.live ? "Watch Live" : "Video Call"}
            </Link>
          </div>
          {!host.live ? (
            <Link
              href={`/call/${encodeURIComponent(host.id)}?live=1&audio=1`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 py-3.5 text-sm font-bold text-white"
            >
              <Phone className="h-4 w-4" />
              Audio Call
            </Link>
          ) : null}
        </div>
      </section>

      <HostProfileAutoCall host={host} />
    </main>
  );
}

function Stat({
  label,
  value,
  gold,
}: {
  label: string;
  value: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${gold ? "text-[#ffd24a]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
