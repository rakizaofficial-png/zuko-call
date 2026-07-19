"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Percent, Search, Video, X } from "lucide-react";
import {
  HostGridCard,
  HostGridSkeleton,
} from "@/components/host/PremiumHostCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletDiamond } from "@/components/WalletDiamond";
import { fetchLiveHosts, searchProfileByAppId } from "@/lib/api";
import {
  filterHosts,
  mergeDiscoverHosts,
  type DiscoverHost,
} from "@/lib/discoverHosts";
import { useApp } from "@/lib/store";
import { useRouter } from "next/navigation";

type Tab = "live" | "call";

const DISCOUNT_KEY = "luma_home_discount_dismissed";
const REGIONS = ["All", "Pakistan", "Philippines", "Brazil", "Vietnam", "India"] as const;

/** Clean home — Live + Calling host cards, modern profile cards */
export function HomeScreen() {
  const { freeTrialAvailable, coins, pushToast } = useApp();
  const router = useRouter();
  const [hosts, setHosts] = useState<DiscoverHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("call");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [searchingId, setSearchingId] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await fetchLiveHosts();
        if (!cancelled) setHosts(mergeDiscoverHosts(live));
      } catch {
        if (!cancelled) setHosts(mergeDiscoverHosts([]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISCOUNT_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setDiscountOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  const dismissDiscount = () => {
    setDiscountOpen(false);
    try {
      sessionStorage.setItem(DISCOUNT_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => {
    let list = filterHosts(hosts, { query, category: "All" });
    if (region !== "All") {
      list = list.filter((h) =>
        h.country.toLowerCase().includes(region.toLowerCase()),
      );
    }
    return list;
  }, [hosts, query, region]);

  const liveHosts = useMemo(
    () => filtered.filter((h) => h.live),
    [filtered],
  );
  const callingHosts = useMemo(
    () => filtered.filter((h) => h.online && !h.live),
    [filtered],
  );

  const list = tab === "live" ? liveHosts : callingHosts;

  const runAppIdSearch = async () => {
    const q = query.trim();
    if (!/^\d{6}$/.test(q)) return;
    setSearchingId(true);
    try {
      const profile = await searchProfileByAppId(q);
      if (!profile) {
        pushToast("User not found");
        return;
      }
      if (profile.role === "host") {
        router.push(`/host/${encodeURIComponent(profile.userId)}`);
      } else {
        pushToast(`Found ${profile.displayName} · ID ${profile.appId}`);
        router.push(`/call/${encodeURIComponent(profile.userId)}?live=1`);
      }
    } catch {
      pushToast("User not found");
    } finally {
      setSearchingId(false);
    }
  };

  return (
    <main className="relative pb-28">
      <header className="overflow-hidden bg-gradient-to-br from-[#ffb020] via-[#ff9a1a] to-[#ff6b2b] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/50">
            Luma
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-bold text-black/80">
              {coins} ¢
            </span>
            <ThemeToggle />
            <WalletDiamond compact />
            <Link
              href="/call"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b1a] text-white shadow"
              aria-label="Video lobby"
            >
              <Video className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <h1 className="font-display text-[1.85rem] font-extrabold leading-tight text-[#2a1600]">
          Meet more friends.
        </h1>
        <Link
          href="/match"
          className="mt-3 inline-flex items-center rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[#2a1600] shadow"
        >
          Tap to Match →
        </Link>
      </header>

      <div className="sticky top-0 z-30 border-b border-line/50 bg-ink/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-ink-2/70 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAppIdSearch();
            }}
            placeholder="Search hosts or 6-digit ID…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {/^\d{6}$/.test(query.trim()) ? (
            <button
              type="button"
              disabled={searchingId}
              onClick={() => void runAppIdSearch()}
              className="shrink-0 rounded-lg bg-coral px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
            >
              {searchingId ? "…" : "Go"}
            </button>
          ) : null}
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                region === r
                  ? "bg-[#ff9f1a] text-black"
                  : "bg-white/8 text-white/70"
              }`}
            >
              {r === "Pakistan"
                ? "🇵🇰 Pakistan"
                : r === "Philippines"
                  ? "🇵🇭 Philippines"
                  : r === "Brazil"
                    ? "🇧🇷 Brazil"
                    : r}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink-2/60 p-1">
          <button
            type="button"
            onClick={() => setTab("live")}
            className={`rounded-xl py-2.5 text-center text-xs font-bold transition ${
              tab === "live"
                ? "bg-coral text-white"
                : "text-muted hover:text-sand"
            }`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setTab("call")}
            className={`rounded-xl py-2.5 text-center text-xs font-bold transition ${
              tab === "call"
                ? "bg-[#ff9f1a] text-black"
                : "text-muted hover:text-sand"
            }`}
          >
            Online
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <HostGridSkeleton count={6} />
        ) : list.length === 0 ? (
          <div className="mx-4 rounded-2xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
            {tab === "live"
              ? "No live hosts right now."
              : "No online hosts for calling."}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setTab(tab === "live" ? "call" : "live")}
                className="text-sm font-bold text-coral"
              >
                Switch to {tab === "live" ? "Online" : "Live"} →
              </button>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-2 gap-3 px-4 pb-8">
            {list.map((h, i) => (
              <HostGridCard
                key={`${tab}-${h.id}`}
                host={h}
                mode={tab === "live" ? "watch" : "call"}
                index={i}
              />
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {discountOpen ? (
          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed bottom-[5.5rem] left-1/2 z-40 w-[min(100%,430px)] -translate-x-1/2 px-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-gold/35 bg-ink-2/95 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-gold/25 blur-2xl" />
              <button
                type="button"
                onClick={dismissDiscount}
                className="absolute right-2 top-2 rounded-full bg-ink-3 p-1 text-muted"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold">
                  <Percent className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-sand">
                    {freeTrialAvailable
                      ? "First call discount"
                      : "Coin boost available"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Message a host or start a call — gifts keep the spark going.
                  </p>
                  <Link
                    href="/profile"
                    onClick={dismissDiscount}
                    className="mt-2 inline-flex text-[11px] font-bold text-gold"
                  >
                    Open wallet →
                  </Link>
                </div>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
