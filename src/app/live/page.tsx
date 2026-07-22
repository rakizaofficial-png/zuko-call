"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  source: "live";
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

function cardSig(list: Card[]) {
  return list
    .map((c) => `${c.id}:${c.roomId}:${c.viewers}:${c.locked ? 1 : 0}`)
    .join("|");
}

export default function LivePage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Live");
  const [region, setRegion] = useState<(typeof REGIONS)[number]["id"]>("All");
  const sigRef = useRef("");

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

        const hosts = hostList.filter((h) => h.isLive);
        const rooms = Array.isArray(roomRes.rooms)
          ? (roomRes.rooms as LiveRoomRow[]).filter((r) => {
              // Only truly live rooms — ended sessions disappear immediately
              if (r.isLive === false) return false;
              if (String(r.mode || "solo") === "party") return false;
              // If API omits isLive, require matching live host presence
              if (r.isLive !== true) {
                const hid = String(r.hostId || "");
                return hosts.some((h) => h.id === hid);
              }
              return true;
            })
          : [];

        const byId = new Map<string, Card>();

        for (const r of rooms) {
          const host = hosts.find((h) => h.id === r.hostId);
          const id = String(r.hostId || r.id);
          if (!id || byId.has(id)) continue;
          const locked = roomLocked(r);
          byId.set(id, {
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
            source: "live",
          });
        }

        for (const h of hosts) {
          if (byId.has(h.id)) continue;
          byId.set(h.id, {
            id: h.id,
            roomId: `live_${h.id}`,
            name: h.name,
            avatar: avatarFor(h.id, h.avatarUrl, h.name),
            title: "Live now",
            viewers: 0,
            country: h.country || "",
            giftCoins: 0,
            locked: false,
            source: "live",
          });
        }

        const next = Array.from(byId.values());
        const sig = cardSig(next);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          setCards(next);
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          // Clear ended / failed polls — never keep fake catalog as “live”
          if (sigRef.current !== "") {
            sigRef.current = "";
            setCards([]);
          }
          setError(e instanceof Error ? e.message : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const t = setInterval(() => void load(), 10_000);
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
      list = [...list].sort(
        (a, b) => b.viewers - a.viewers || b.giftCoins - a.giftCoins,
      );
    }
    // Dedupe by host id
    const seen = new Set<string>();
    return list.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [cards, region, tab]);

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0b0b0f] text-white">
      {/* Top tabs — fixed */}
      <header className="safe-header z-20 shrink-0 border-b border-white/5 bg-[#0b0b0f] px-3">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28">
        {/* Promo strip */}
        <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ffb020] via-[#ffd24a] to-[#ffe58a] px-4 py-3.5 text-[#3a2200] shadow-[0_8px_24px_rgba(255,138,0,0.2)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
            Live guidelines
          </p>
          <p className="mt-0.5 font-display text-[17px] font-extrabold leading-snug">
            Host-only streams · gift &amp; chat in real time
          </p>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                region === r.id
                  ? "bg-[#ff9f1a] text-black"
                  : "bg-white/8 text-white/70"
              }`}
            >
              {r.flag ? `${r.flag} ${r.label}` : r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <section className="mt-3 grid grid-cols-2 gap-2.5 px-3 pb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-white/5"
              />
            ))}
          </section>
        ) : filtered.length === 0 ? (
          <div className="mx-3 mt-6 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-[#ff8a00]" />
            <p className="mt-3 font-display text-base font-bold">
              No one is live yet
            </p>
            <p className="mt-1 text-xs text-white/50">
              When a host taps Go Live, they appear here instantly.
            </p>
            {error ? (
              <p className="mt-2 text-[10px] text-white/35">{error}</p>
            ) : null}
            <Link
              href="/call"
              className="mt-4 inline-flex rounded-full bg-[#ff9f1a] px-4 py-2.5 text-xs font-bold text-black"
            >
              Browse 1v1 hosts
            </Link>
          </div>
        ) : (
          <section className="mt-3 grid grid-cols-2 gap-2.5 px-3 pb-8">
            {filtered.map((c) => (
              <Link
                key={`${c.source}-${c.roomId}-${c.id}`}
                href={`/live/${encodeURIComponent(c.id)}${c.locked ? "?premium=1" : ""}`}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#16161c]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#ff3b5c] px-2 py-0.5 text-[10px] font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  LIVE
                </span>
                {c.locked ? (
                  <span className="absolute right-2 top-2 rounded-full bg-gold/90 px-2 py-0.5 text-[9px] font-bold text-black">
                    Premium
                  </span>
                ) : null}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70">
                    <Eye className="h-3 w-3" />
                    {c.viewers}
                    {c.country ? ` · ${flagEmoji(c.country)}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}