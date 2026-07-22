"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, EyeOff, Shuffle, Sparkles, Zap } from "lucide-react";
import { fetchLiveHosts, type LiveHost } from "@/lib/api";
import { filterFemaleHosts } from "@/lib/femaleHosts";
import { useApp } from "@/lib/store";
import { isAutoCallEligibleProfile } from "@/lib/welcomePush/premiumFemaleGenerator";

/** Dedicated Match page — instant / blind / free trial matching (female hosts only) */
export default function MatchPage() {
  const router = useRouter();
  const { isPremium, spend, pushToast, freeTrialAvailable } = useApp();
  const [readyCount, setReadyCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadPool = useCallback(async (): Promise<LiveHost[]> => {
    try {
      const all = await fetchLiveHosts();
      const pool = filterFemaleHosts(
        all.filter((h) => h.isOnline && !h.isLive && !h.isOnCall),
      ).filter((h) =>
        isAutoCallEligibleProfile({
          id: h.id,
          name: h.name,
          gender: h.gender || "female",
          avatar: h.avatarUrl,
        }),
      );
      setReadyCount(pool.length);
      return pool;
    } catch {
      setReadyCount(0);
      return [];
    }
  }, []);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const runMatch = async (mode: "instant" | "blind" | "trial") => {
    setLoading(true);
    try {
      const apiPool = await loadPool();
      if (!apiPool.length) {
        pushToast("No hosts available — try Live or check back soon");
        return;
      }

      const pick = apiPool[Math.floor(Math.random() * apiPool.length)]!;

      if (mode === "trial") {
        if (!freeTrialAvailable) {
          pushToast("Free trial already used");
          return;
        }
        router.push(`/call/${pick.id}?trial=1&live=1`);
        return;
      }

      if (mode === "instant") {
        const cost = isPremium ? 30 : 60;
        if (!spend(cost, "Instant match…")) return;
        router.push(`/call/${pick.id}?live=1`);
        return;
      }

      const cost = isPremium ? 15 : 30;
      if (!spend(cost, "Blind match…")) return;
      router.push(`/call/${pick.id}?blur=1&live=1`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pb-10">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/80 px-4 pb-3 backdrop-blur-xl">
        <Link href="/call" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-coral">
            Match
          </p>
          <h1 className="font-display text-xl font-bold">Find a host</h1>
        </div>
      </header>

      <section className="px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-coral/25 via-ink-2 to-gold/15 p-6 text-center"
        >
          <Shuffle className="mx-auto h-10 w-10 text-coral" />
          <h2 className="mt-3 font-display text-2xl font-extrabold">
            Random match
          </h2>
          <p className="mt-2 text-sm text-muted">
            Pair with a waiting 1v1 host. Live streamers stay on Live.
          </p>
          <p className="mt-3 text-xs font-bold text-teal">
            {readyCount
              ? `${readyCount} host${readyCount === 1 ? "" : "s"} ready`
              : "No calling hosts online right now"}
          </p>
        </motion.div>
      </section>

      <section className="space-y-3 px-4 pb-10">
        <button
          type="button"
          disabled={loading}
          onClick={() => void runMatch("instant")}
          className="glass-card flex w-full items-center gap-3 rounded-2xl border border-coral/30 p-4 text-left disabled:opacity-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral text-white">
            <Zap className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold">
              Instant Match
            </span>
            <span className="text-xs text-muted">
              {isPremium ? 30 : 60} coins · random calling host
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => void runMatch("blind")}
          className="glass-card flex w-full items-center gap-3 rounded-2xl border border-cyan/30 p-4 text-left disabled:opacity-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan/20 text-cyan">
            <EyeOff className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold">
              Blind Match
            </span>
            <span className="text-xs text-muted">
              {isPremium ? 15 : 30} coins · blur reveal · 50% off
            </span>
          </span>
        </button>

        {freeTrialAvailable ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void runMatch("trial")}
            className="glass-card flex w-full items-center gap-3 rounded-2xl border border-gold/30 p-4 text-left disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/20 text-gold">
              <Sparkles className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold">
                30s Free Trial
              </span>
              <span className="text-xs text-muted">
                New users · one complimentary intro call
              </span>
            </span>
          </button>
        ) : null}

        <Link
          href="/call"
          className="block pt-2 text-center text-sm font-bold text-coral"
        >
          Browse calling host cards →
        </Link>
      </section>
    </main>
  );
}
