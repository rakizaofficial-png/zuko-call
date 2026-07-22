"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Percent, RefreshCw, Search, X } from "lucide-react";
import {
  HostGridCard,
  HostGridSkeleton,
} from "@/components/host/PremiumHostCard";
import { HomePromoSwipe } from "@/components/home/HomePromoSwipe";
import { LibraryPreviewPlayer } from "@/components/media/LibraryPreviewPlayer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletDiamond } from "@/components/WalletDiamond";
import { fetchLiveHosts, searchProfileByAppId } from "@/lib/api";
import {
  catalogDiscoverHosts,
  filterHosts,
  mergeDiscoverHosts,
  rotateHosts,
  sectionHosts,
  type DiscoverHost,
} from "@/lib/discoverHosts";
import { filterBlockedHosts } from "@/lib/socialLists";
import { fetchHomeBanners, type PromoSlide } from "@/lib/homeBanners";
import { useApp } from "@/lib/store";
import { useRouter } from "next/navigation";

type Tab = "live" | "call";

const DISCOUNT_KEY = "luma_home_discount_dismissed";
const REGIONS = ["All", "Pakistan", "Philippines", "Brazil", "Vietnam", "India"] as const;
const CATEGORIES = [
  "All",
  "Trending",
  "New",
  "Top Rated",
  "Nearby",
  "Party",
  "Chill",
] as const;

/** Clean home — compact admin hero + swipe promos + host cards */
export function HomeScreen() {
  const { freeTrialAvailable, coins, pushToast } = useApp();
  const router = useRouter();
  const [hosts, setHosts] = useState<DiscoverHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("call");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("All");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [searchingId, setSearchingId] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [promos, setPromos] = useState<PromoSlide[]>([]);
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(0);
  const hostSigRef = useRef<string>("");
  const promoSigRef = useRef<string>("");
  const reloadHostsRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Only commit a new host list when it actually changed, so the 8s poll
    // doesn't force a redundant re-render (and flicker) on unchanged data.
    const applyHosts = (next: DiscoverHost[]) => {
      const sig = next
        .map((h) => `${h.id}:${h.online ? 1 : 0}${h.live ? 1 : 0}${h.onCall ? 1 : 0}`)
        .join("|");
      if (sig === hostSigRef.current) return;
      hostSigRef.current = sig;
      setHosts(next);
    };

    // A cold/unreachable backend fetch can hang with no timeout, leaving the
    // skeleton loader spinning indefinitely. Clear the initial loading state
    // after a short grace period so we fall back to the empty/list UI fast.
    const loadingGuard = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 3500);

    const load = async () => {
      try {
        const live = await fetchLiveHosts();
        if (!cancelled) applyHosts(mergeDiscoverHosts(live));
      } catch {
        if (!cancelled) applyHosts(mergeDiscoverHosts([]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    reloadHostsRef.current = load;
    void load();
    const timer = setInterval(() => void load(), 8_000);
    return () => {
      cancelled = true;
      clearTimeout(loadingGuard);
      clearInterval(timer);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadHostsRef.current();
      setRotationSeed((s) => s + 1);
      pushToast("Hosts refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadBanners = async () => {
      const data = await fetchHomeBanners();
      if (cancelled) return;
      const next = data.promos || [];
      const sig = next.map((p) => p.id).join("|");
      if (sig === promoSigRef.current) return;
      promoSigRef.current = sig;
      setPromos(next);
    };
    void loadBanners();
    const t = setInterval(() => void loadBanners(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
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
    let list = filterHosts(hosts, { query, category });
    if (region !== "All") {
      list = list.filter((h) =>
        h.country.toLowerCase().includes(region.toLowerCase()),
      );
    }
    return filterBlockedHosts(list);
  }, [hosts, query, region, category]);

  const sections = useMemo(() => sectionHosts(filtered), [filtered]);

  const liveHosts = useMemo(
    () => filtered.filter((h) => h.live),
    [filtered],
  );
  const callingHosts = useMemo(
    () => filtered.filter((h) => h.online && !h.live),
    [filtered],
  );

  const baseList = tab === "live" ? liveHosts : callingHosts;

  // Auto-rotation: bump a seed on a timer and whenever the tab becomes visible
  // so the discovery feed never looks static — profiles reshuffle over time
  // and on every return to the screen.
  // Start from a fixed seed so SSR and the first client render match (no
  // hydration mismatch); randomize + start rotating only after mount.
  const [rotationSeed, setRotationSeed] = useState(0);
  useEffect(() => {
    setRotationSeed(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setRotationSeed((s) => s + 1), 15000);
    const onVis = () => {
      if (!document.hidden) setRotationSeed((s) => s + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Keep the feed populated with fresh, rotating faces even when the live API
  // returns nothing (falls back to catalog hosts), then shuffle by the seed.
  const list = useMemo(() => {
    let src = baseList;
    if (src.length === 0) {
      src = catalogDiscoverHosts(tab === "live" ? "live" : "call").filter(
        (h) =>
          region === "All" ||
          h.country.toLowerCase().includes(region.toLowerCase()),
      );
    }
    return rotateHosts(src, rotationSeed);
  }, [baseList, tab, region, rotationSeed]);

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
      <header
        ref={headerRef}
        className="safe-header fixed left-1/2 top-0 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-line/50 bg-ink/90 px-4 pb-3 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              aria-expanded={searchOpen}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line ${
                searchOpen ? "bg-coral text-white" : "bg-ink-2/80 text-sand"
              }`}
            >
              <Search className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-line bg-ink-2/80 px-2.5 py-1.5 text-xs font-bold text-sand">
              {coins} ¢
            </span>
            <ThemeToggle />
            <WalletDiamond compact />
          </div>
          <Link
            href="/match"
            className="shrink-0 rounded-full bg-gradient-to-r from-[#ffb020] to-[#ff6b2b] px-3.5 py-2 text-[11px] font-bold text-black shadow"
          >
            Tap to Match →
          </Link>
        </div>

        <AnimatePresence initial={false}>
          {searchOpen ? (
            <motion.label
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2 overflow-hidden rounded-2xl border border-line bg-ink-2/70 px-3 py-2.5"
            >
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                autoFocus
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
            </motion.label>
          ) : null}
        </AnimatePresence>
      </header>

      <div aria-hidden style={{ height: headerH }} />

      <HomePromoSwipe promos={promos} />

      <div className="px-4 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-1.5 rounded-full border border-line bg-ink-2/70 p-1">
            {(
              [
                ["call", "Online"],
                ["live", "Live"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-9 rounded-full px-3.5 text-xs font-bold ${
                  tab === id ? "bg-coral text-white" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-ink-2/80 px-3 text-xs font-bold text-sand disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="mt-2 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                category === c
                  ? "bg-cyan/20 text-cyan"
                  : "bg-white/6 text-white/65"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <LibraryPreviewPlayer category="preview" countdownSec={8} />
      </div>

      {!loading ? (
        <div className="mt-4 space-y-4">
          <HostRail
            title="Recommended"
            hosts={sections.recommended}
            mode={tab === "live" ? "watch" : "call"}
          />
          <HostRail
            title="Online hosts"
            hosts={sections.online.filter((h) => !h.live)}
            mode="call"
          />
          <HostRail title="New hosts" hosts={sections.newest} mode="call" />
          <HostRail
            title="Top hosts"
            hosts={sections.topRated}
            mode="call"
          />
          <HostRail
            title="Trending"
            hosts={sections.trending}
            mode={tab === "live" ? "watch" : "call"}
          />
          <HostRail
            title="Recently active"
            hosts={sections.recent}
            mode="call"
          />
        </div>
      ) : null}

      <div className="mt-4">
        <h2 className="mb-2 px-4 font-display text-sm font-bold">
          {tab === "live" ? "Live now" : "Ready to call"}
        </h2>
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

function HostRail({
  title,
  hosts,
  mode,
}: {
  title: string;
  hosts: DiscoverHost[];
  mode: "call" | "watch";
}) {
  if (!hosts.length) return null;
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-end justify-between px-4">
        <h2 className="font-display text-sm font-bold">{title}</h2>
        <span className="text-[10px] text-muted">{hosts.length}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {hosts.slice(0, 8).map((h, i) => (
          <div key={`${title}-${h.id}`} className="w-[42%] min-w-[148px] max-w-[170px] shrink-0">
            <HostGridCard host={h} mode={mode} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
