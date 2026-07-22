"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Radio, Search, Trophy } from "lucide-react";
import { fetchLiveHosts, type LiveHost } from "@/lib/api";
import { requireApiBase } from "@/config/apiConfig";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";
import { catalogDiscoverHosts } from "@/lib/discoverHosts";

type LiveRoomRow = {
  id: string;
  hostId?: string;
  hostName?: string;
  hostAvatar?: string;
  title?: string;
  viewers?: number;
  giftCoins?: number;
  isLive?: boolean;
  mode?: string;
  country?: string;
  thumbnailUrl?: string;
  isLocked?: boolean;
  locked?: boolean;
  isPremium?: boolean;
  premium?: boolean;
};

type Card = {
  id: string;
  roomId: string;
  name: string;
  avatar: string;
  title: string;
  viewers: number;
  country: string;
  giftCoins: number;
  locked: boolean;
  source: "live" | "catalog";
};

/** Match mobile reference: Live · Talent · New */
const TABS = ["Live", "Talent", "New"] as const;
const REGIONS = [
  { id: "All", label: "All", flag: "" },
  { id: "Pakistan", label: "Pakistan", flag: "🇵🇰" },
  { id: "Philippines", label: "Philippines", flag: "🇵🇭" },
  { id: "Brazil", label: "Brazil", flag: "🇧🇷" },
  { id: "Vietnam", label: "Vietnam", flag: "🇻🇳" },
  { id: "India", label: "India", flag: "🇮🇳" },
  { id: "USA", label: "USA", flag: "🇺🇸" },
] as const;

function avatarFor(id: string, url?: string | null, name?: string) {
  return pickHostAvatarUrl({ avatarUrl: url }, { hostId: id, name });
}

function flagEmoji(country: string) {
  const hit = REGIONS.find(
    (r) => r.id !== "All" && country.toLowerCase().includes(r.id.toLowerCase()),
  );
  return hit?.flag || "🌍";
}

function roomLocked(r: LiveRoomRow) {
  return Boolean(
    r.isLocked ||
      r.locked ||
      r.isPremium ||
      r.premium ||
      r.mode === "premium" ||
      r.mode === "locked",
  );
}

function catalogFallbackCards(): Card[] {
  return catalogDiscoverHosts("live").map((h, i) => ({
    id: h.id,
    roomId: `live_${h.id}`,
    name: h.name,
    avatar: h.avatarUrl,
    title: h.bio || "Live now",
    viewers: 12 + ((i * 17) % 90),
    country: h.country,
    giftCoins: 0,
    locked: false,
    source: "catalog" as const,
  }));
}

export default function LivePage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Live");
  const [region, setRegion] = useState<(typeof REGIONS)[number]["id"]>("All");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [hostList, roomRes] = await Promise.all([
          fetchLiveHosts({ readyOnly: false }).catch(() => [] as LiveHost[]),
          fetch(`${requireApiBase()}/live/rooms`, { cache: "no-store" })
            .then((r) => r.json())
            .catch(() => ({ rooms: [] })),
        ]);
        if (cancelled) return;

        const hosts = hostList.filter((h) => h.isOnline || h.isLive);
        const rooms = Array.isArray(roomRes.rooms)
          ? (roomRes.rooms as LiveRoomRow[]).filter((r) => {
              if (r.isLive === false) return false;
              if (String(r.mode || "solo") === "party") return false;
              return true;
            })
          : [];

        let next: Card[] = [];

        if (rooms.length > 0) {
          next = rooms.map((r) => {
            const host = hosts.find((h) => h.id === r.hostId);
            const id = String(r.hostId || r.id);
            const locked = roomLocked(r);
            return {
              id,
              roomId: String(r.id || `live_${id}`),
              name: r.hostName || host?.name || "Host",
              avatar: avatarFor(
                id,
                host?.avatarUrl || r.hostAvatar || r.thumbnailUrl,
                r.hostName || host?.name || "Host",
              ),
              title: r.title || (locked ? "Premium live" : "Live now"),
              viewers: Number(r.viewers) || 0,
              country: r.country || host?.country || "",
              giftCoins: Number(r.giftCoins) || 0,
              locked,
              source: "live" as const,
            };
          });
        }

        // Presence hosts marked live (even if rooms list empty)
        if (next.length === 0) {
          next = hosts
            .filter((h) => h.isLive)
            .map((h) => ({
              id: h.id,
              roomId: `live_${h.id}`,
              name: h.name,
              avatar: avatarFor(h.id, h.avatarUrl, h.name),
              title: "Live now",
              viewers: 0,
              country: h.country || "",
              giftCoins: 0,
              locked: false,
              source: "live" as const,
            }));
        }

        // Mobile: never leave an empty Live grid — catalog live faces as fallback
        if (next.length === 0) {
          next = catalogFallbackCards();
        }

        setCards(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          // Still show catalog so the UI isn't a blank dead-end on mobile
          setCards(catalogFallbackCards());
          setError(e instanceof Error ? e.message : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const t = setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const filtered = useMemo(() => {
    let list = cards;
    if (region !== "All") {
      list = list.filter((c) =>
        c.country.toLowerCase().includes(region.toLowerCase()),
      );
    }
    if (tab === "New") list = [...list].reverse();
    if (tab === "Talent") {
      list = [...list].sort((a, b) => b.viewers - a.viewers || b.giftCoins - a.giftCoins);
    }
    return list;
  }, [cards, region, tab]);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#0b0b0f] pb-28 text-white">
      {/* Top tabs — mobile reference */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0b0f]/95 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-end gap-2">
          <nav className="flex min-w-0 flex-1 gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 pb-2.5 text-[16px] font-semibold ${
                  tab === t
                    ? "border-b-2 border-[#ff8a00] text-white"
                    : "border-b-2 border-transparent text-white/40"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="mb-1.5 p-2 text-white/70"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="mb-1.5 p-2 text-white/70"
            aria-label="Ranking"
          >
            <Trophy className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Promo strip */}
      <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ffb020] via-[#ffd24a] to-[#ffe58a] px-4 py-3.5 text-[#3a2200] shadow-[0_8px_24px_rgba(255,138,0,0.2)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
          Live guidelines
        </p>
        <p className="mt-0.5 font-display text-[17px] font-extrabold leading-snug">
          Host-only streams · gift &amp; chat in real time
        </p>
      </div>

      {/* Region chips with flags */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRegion(r.id)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              region === r.id
                ? "bg-[#ff8a00] text-black"
                : "bg-white/[0.08] text-white/70"
            }`}
          >
            {r.flag ? <span>{r.flag}</span> : null}
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <section className="mt-3 grid grid-cols-2 gap-2.5 px-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-2xl bg-white/8"
            />
          ))}
        </section>
      ) : filtered.length === 0 ? (
        <div className="mx-3 mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center">
          <Radio className="mx-auto mb-3 h-8 w-8 text-[#ff8a00]" />
          <p className="font-display text-lg font-bold">No one is live yet</p>
          <p className="mt-1 text-sm text-white/55">
            {error
              ? "Couldn’t reach live servers — try 1v1 hosts."
              : "When a host taps Go Live, they appear here instantly."}
          </p>
          <Link
            href="/call"
            className="mt-4 inline-flex rounded-full bg-[#ff8a00] px-5 py-2.5 text-xs font-bold text-black"
          >
            Browse 1v1 hosts
          </Link>
        </div>
      ) : (
        <section className="mt-3 grid grid-cols-2 gap-2.5 px-3 pb-8">
          {filtered.map((card) => (
            <Link
              key={`${card.source}-${card.roomId}-${card.id}`}
              href={
                card.source === "catalog"
                  ? `/call/${encodeURIComponent(card.id)}?live=1`
                  : `/live/${encodeURIComponent(card.id)}`
              }
              className="group relative block overflow-hidden rounded-2xl bg-[#16161c] shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.avatar}
                alt={card.name}
                loading="lazy"
                className="aspect-[3/4] w-full object-cover object-top transition duration-500 group-active:scale-105"
                onError={(e) => {
                  const el = e.currentTarget;
                  const fallback = avatarFor(card.id, null, card.name);
                  if (el.src !== fallback) el.src = fallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/10" />

              {/* LIVE pill — bottom-left like modern apps */}
              <div className="absolute bottom-10 left-2 flex items-center gap-1 rounded-md bg-[#ff8a00] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-black">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
                Live
              </div>

              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Eye className="h-3 w-3" />
                {card.viewers > 0 ? card.viewers.toLocaleString() : "·"}
              </div>

              {card.locked ? (
                <div className="absolute right-2 top-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  🔒 Premium
                </div>
              ) : card.giftCoins > 0 ? (
                <div className="absolute right-2 top-2 rounded-md bg-[#7b2cff]/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  💎 {card.giftCoins}
                </div>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="flex items-center gap-1 text-[12px] font-bold text-white">
                  <span className="truncate">{card.name}</span>
                  <span className="shrink-0 text-[11px]">
                    {flagEmoji(card.country)}
                  </span>
                </p>
                <p className="truncate text-[10px] text-white/65">{card.title}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
