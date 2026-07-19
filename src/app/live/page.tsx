"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Radio, Search, Trophy } from "lucide-react";
import { fetchLiveHosts, type LiveHost } from "@/lib/api";
import { requireApiBase } from "@/config/apiConfig";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";

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
};

const TABS = ["Following", "Live", "Talent", "New"] as const;
const REGIONS = ["All", "Pakistan", "Philippines", "Brazil", "Vietnam", "India", "USA"] as const;

function avatarFor(id: string, url?: string | null, name?: string) {
  return pickHostAvatarUrl({ avatarUrl: url }, { hostId: id, name });
}

function flagEmoji(country: string) {
  const map: Record<string, string> = {
    Pakistan: "🇵🇰",
    Philippines: "🇵🇭",
    Brazil: "🇧🇷",
    Vietnam: "🇻🇳",
    India: "🇮🇳",
    USA: "🇺🇸",
    "United States": "🇺🇸",
  };
  return map[country] || "🌍";
}

export default function LivePage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Live");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");

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
          ? (roomRes.rooms as LiveRoomRow[]).filter(
              (r) => r.isLive !== false && String(r.mode || "solo") !== "party",
            )
          : [];

        let next: Card[] = [];
        if (rooms.length > 0) {
          next = rooms.map((r) => {
            const host = hosts.find((h) => h.id === r.hostId);
            const id = String(r.hostId || r.id);
            return {
              id,
              roomId: r.id,
              name: r.hostName || host?.name || "Host",
              avatar: avatarFor(
                id,
                host?.avatarUrl || r.hostAvatar || r.thumbnailUrl,
                r.hostName || host?.name || "Host",
              ),
              title: r.title || "Live now",
              viewers: Number(r.viewers) || 0,
              country: r.country || host?.country || "",
              giftCoins: Number(r.giftCoins) || 0,
            };
          });
        } else {
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
            }));
        }
        setCards(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load live");
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
    if (tab === "New") {
      list = [...list].reverse();
    }
    return list;
  }, [cards, region, tab]);

  return (
    <main className="min-h-dvh bg-[#0b0b0f] pb-6 text-white">
      {/* Top tabs */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0b0f]/95 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center gap-1">
          <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 pb-2.5 text-[15px] font-semibold ${
                  tab === t
                    ? "border-b-2 border-[#ff8a00] text-white"
                    : "border-b-2 border-transparent text-white/45"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button type="button" className="p-2 text-white/70" aria-label="Ranking">
            <Trophy className="h-5 w-5" />
          </button>
          <button type="button" className="p-2 text-white/70" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Promo strip */}
      <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ffb020] via-[#ffd24a] to-[#ffe58a] px-4 py-3 text-[#3a2200]">
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">Live guidelines</p>
        <p className="font-display text-lg font-extrabold leading-tight">
          Host-only streams · gift &amp; chat in real time
        </p>
      </div>

      {/* Region chips */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              region === r
                ? "bg-[#ff8a00] text-black"
                : "bg-white/8 text-white/70"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-white/50">
          Finding live hosts…
        </p>
      ) : error ? (
        <p className="px-4 py-10 text-center text-sm text-rose-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="mx-4 mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center">
          <Radio className="mx-auto mb-3 h-8 w-8 text-[#ff8a00]" />
          <p className="font-display text-lg font-bold">No one is live yet</p>
          <p className="mt-1 text-sm text-white/55">
            When a host taps Go Live, they appear here instantly.
          </p>
          <Link
            href="/call"
            className="mt-4 inline-flex rounded-full bg-[#ff8a00] px-4 py-2 text-xs font-bold text-black"
          >
            Browse 1v1 hosts
          </Link>
        </div>
      ) : (
        <section className="mt-3 grid grid-cols-2 gap-2.5 px-3">
          {filtered.map((card) => (
            <Link
              key={card.roomId + card.id}
              href={`/live/${encodeURIComponent(card.id)}`}
              className="group relative block overflow-hidden rounded-2xl bg-[#16161c]"
            >
              <img
                src={card.avatar}
                alt={card.name}
                className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105"
                onError={(e) => {
                  const el = e.currentTarget;
                  const fallback = avatarFor(card.id, null, card.name);
                  if (el.src !== fallback) el.src = fallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/20" />
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Eye className="h-3 w-3" />
                {card.viewers > 0 ? card.viewers.toLocaleString() : "Live"}
              </div>
              {card.giftCoins > 0 && (
                <div className="absolute right-2 top-2 rounded-md bg-[#7b2cff]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  💎 {card.giftCoins}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="flex items-center gap-1 text-xs font-bold text-white">
                  <span>{flagEmoji(card.country)}</span>
                  <span className="truncate">{card.name}</span>
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
