"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, Zap } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { CreatorCard } from "@/components/CreatorCard";
import { creators, engagingLines } from "@/lib/data";
import { useApp } from "@/lib/store";

const filters = ["For you", "Online", "Live now", "Nearby", "New"] as const;

export default function DiscoverPage() {
  const { isPremium } = useApp();
  const [lineIdx, setLineIdx] = useState(0);
  const [filter, setFilter] = useState<(typeof filters)[number]>("For you");

  useEffect(() => {
    const t = setInterval(() => {
      setLineIdx((i) => (i + 1) % engagingLines.length);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const list = useMemo(() => {
    switch (filter) {
      case "Online":
        return creators.filter((c) => c.online);
      case "Live now":
        return creators.filter((c) => c.live);
      case "Nearby":
        return [...creators].sort((a, b) => a.country.localeCompare(b.country));
      case "New":
        return [...creators].reverse();
      default:
        return creators;
    }
  }, [filter]);

  return (
    <main>
      <TopBar title="Discover" subtitle={engagingLines[lineIdx]} />

      <section className="px-4 pb-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl border border-line bg-ink-2"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-coral/25 blur-2xl" />
          <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-gold/20 blur-2xl" />
          <div className="relative p-5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Tonight’s spark
            </p>
            <h2 className="font-display text-2xl font-extrabold leading-tight text-sand">
              Meet someone new
              <br />
              in one tap
            </h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 max-w-[17rem] text-sm text-muted"
              >
                {engagingLines[lineIdx]} Live, private 1v1, and chat — all on
                coins.
              </motion.p>
            </AnimatePresence>
            <div className="mt-4 flex gap-2">
              <Link
                href="/call"
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_30px_var(--glow)]"
              >
                <Zap className="h-4 w-4" /> Match & call
              </Link>
              <Link
                href="/live"
                className="inline-flex items-center rounded-full border border-line bg-ink-3 px-4 py-2.5 text-sm font-semibold text-sand"
              >
                Watch live
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {!isPremium && (
        <section className="px-4 py-3">
          <Link
            href="/premium"
            className="flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/15 to-coral/10 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold">
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-sand">Go VIP Premium</p>
                <p className="text-xs text-muted">
                  Cheaper matches · exclusive badge · daily coins
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-gold">See plans</span>
          </Link>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "bg-sand text-ink"
                : "border border-line bg-ink-2 text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 px-4 pb-6 pt-2">
        {list.map((c, i) => (
          <CreatorCard key={c.id} creator={c} index={i} />
        ))}
      </section>
    </main>
  );
}
