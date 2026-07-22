"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, History, UserPlus } from "lucide-react";
import { HostGridCard } from "@/components/host/PremiumHostCard";
import { fetchLiveHosts } from "@/lib/api";
import {
  catalogDiscoverHosts,
  mergeDiscoverHosts,
  type DiscoverHost,
} from "@/lib/discoverHosts";
import {
  getFavorites,
  getRecentlyViewed,
  toggleFavorite,
} from "@/lib/socialLists";
import { useApp } from "@/lib/store";

export default function FavoritesPage() {
  const { following, pushToast } = useApp();
  const [hosts, setHosts] = useState<DiscoverHost[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"favorites" | "following" | "recent">(
    "favorites",
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const live = await fetchLiveHosts();
        if (!cancelled) setHosts(mergeDiscoverHosts(live));
      } catch {
        if (!cancelled) setHosts(catalogDiscoverHosts("call"));
      }
      if (!cancelled) {
        setFavIds(getFavorites());
        setRecentIds(getRecentlyViewed());
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map(hosts.map((h) => [h.id, h]));
    for (const h of catalogDiscoverHosts("call")) {
      if (!map.has(h.id)) map.set(h.id, h);
    }
    return map;
  }, [hosts]);

  const list = useMemo(() => {
    const ids =
      tab === "favorites"
        ? favIds
        : tab === "following"
          ? following
          : recentIds;
    return ids
      .map((id) => byId.get(id))
      .filter((h): h is DiscoverHost => Boolean(h));
  }, [tab, favIds, following, recentIds, byId]);

  const removeFav = (id: string) => {
    toggleFavorite(id);
    setFavIds(getFavorites());
    pushToast("Removed from favorites");
  };

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-coral">
            Social
          </p>
          <h1 className="font-display text-xl font-bold">Favorites</h1>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["favorites", "Favorites", Heart],
            ["following", "Following", UserPlus],
            ["recent", "Recently viewed", History],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold ${
              tab === id
                ? "bg-coral text-white"
                : "border border-line bg-ink-2/60 text-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-line px-4 py-14 text-center">
          <p className="font-display text-sm font-bold">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted">
            Heart hosts on their profile to save them for later.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-coral px-4 py-2 text-xs font-bold text-white"
          >
            Discover hosts
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3 px-4 pb-8">
          {list.map((h, i) => (
            <div key={h.id} className="relative">
              <HostGridCard host={h} mode="call" index={i} />
              {tab === "favorites" ? (
                <button
                  type="button"
                  onClick={() => removeFav(h.id)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-black/55 p-2 text-coral backdrop-blur"
                  aria-label="Remove favorite"
                >
                  <Heart className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
