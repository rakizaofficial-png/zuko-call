"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Coins,
  Gift,
  Play,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { coinPacks, dailyTasks } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function WalletPage() {
  const { coins, addCoins, isPremium, pushToast } = useApp();
  const [selected, setSelected] = useState(
    coinPacks.find((p) => p.popular)?.id ?? coinPacks[2].id,
  );
  const [buying, setBuying] = useState(false);
  const [tasks, setTasks] = useState(dailyTasks);
  const [checkedIn, setCheckedIn] = useState(false);

  const pack = coinPacks.find((p) => p.id === selected)!;

  const buyWithPlayStore = () => {
    setBuying(true);
    pushToast("Opening Google Play…");
    setTimeout(() => {
      const total = pack.coins + (pack.bonus ?? 0);
      addCoins(total, `Play Store · +${total.toLocaleString()} coins`);
      setBuying(false);
    }, 1400);
  };

  const claimTask = (id: string, reward: number) => {
    setTasks((list) =>
      list.map((t) => (t.id === id ? { ...t, done: true } : t)),
    );
    addCoins(reward, `Task complete · +${reward} coins`);
  };

  const dailyCheckIn = () => {
    if (checkedIn) return;
    const bonus = isPremium ? 80 : 40;
    setCheckedIn(true);
    addCoins(bonus, `Daily check-in · +${bonus} coins`);
  };

  return (
    <main>
      <TopBar
        title="Coin wallet"
        subtitle="Recharge via Play Store. Spend on calls, gifts & live."
      />

      <section className="px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-line bg-ink-2 p-5"
        >
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gold/25 blur-2xl" />
          <div className="absolute -bottom-8 left-8 h-24 w-24 rounded-full bg-coral/20 blur-2xl" />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
              <Coins className="h-3.5 w-3.5" /> Balance
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold tabular-nums">
              {coins.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted">
              Coins power 1v1 calls, live gifts, and unlocked snaps
            </p>
            <button
              type="button"
              onClick={dailyCheckIn}
              disabled={checkedIn}
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                checkedIn
                  ? "border border-line bg-ink-3 text-muted"
                  : "bg-gold text-ink"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              {checkedIn
                ? "Checked in today"
                : `Daily check-in · +${isPremium ? 80 : 40}`}
            </button>
          </div>
        </motion.div>
      </section>

      <section className="px-4 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Play Store packs</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2.5 py-1 text-[10px] font-bold text-teal">
            <Play className="h-3 w-3 fill-current" /> Google Play
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {coinPacks.map((p, i) => {
            const active = selected === p.id;
            return (
              <motion.button
                key={p.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(p.id)}
                className={`relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? "border-coral bg-coral/10 shadow-[0_0_24px_var(--glow)]"
                    : "border-line bg-ink-2"
                }`}
              >
                {(p.popular || p.best) && (
                  <span
                    className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      p.best
                        ? "bg-gold text-ink"
                        : "bg-coral text-white"
                    }`}
                  >
                    {p.tag}
                  </span>
                )}
                <p className="font-display text-xl font-extrabold tabular-nums">
                  {p.coins.toLocaleString()}
                </p>
                {p.bonus ? (
                  <p className="text-[11px] font-semibold text-teal">
                    +{p.bonus} bonus
                  </p>
                ) : (
                  <p className="text-[11px] text-muted">{p.tag ?? "Coins"}</p>
                )}
                <p className="mt-2 text-sm font-bold text-sand">{p.price}</p>
                {active && (
                  <span className="absolute bottom-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={buying}
          onClick={buyWithPlayStore}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-sand py-3.5 text-sm font-bold text-ink disabled:opacity-70"
        >
          <Store className="h-4 w-4" />
          {buying
            ? "Processing Play purchase…"
            : `Buy ${pack.coins.toLocaleString()} coins · ${pack.price}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          Secure billing through Google Play · restore purchases anytime
        </p>
      </section>

      <section className="px-4 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-coral" />
          <h2 className="font-display text-lg font-bold">Earn free coins</h2>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2 px-3 py-3"
            >
              <span className="text-xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-[11px] text-gold">+{t.reward} coins</p>
              </div>
              {t.done ? (
                <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[10px] font-bold text-teal">
                  Done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => claimTask(t.id, t.reward)}
                  className="rounded-full bg-coral px-3 py-1.5 text-[10px] font-bold text-white"
                >
                  Claim
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {!isPremium && (
        <section className="px-4 pb-8">
          <Link
            href="/premium"
            className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/20 to-coral/10 px-4 py-4"
          >
            <Zap className="h-6 w-6 text-gold" />
            <div className="flex-1">
              <p className="font-display font-bold">VIP saves on every call</p>
              <p className="text-xs text-muted">
                Half-price matches · daily coin boost · exclusive badge
              </p>
            </div>
            <span className="text-xs font-bold text-gold">Upgrade</span>
          </Link>
        </section>
      )}

      <AnimatePresence>
        {buying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl border border-line bg-ink-2 p-6 text-center"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/20 text-teal">
                <Play className="h-7 w-7 fill-current" />
              </div>
              <p className="font-display text-lg font-bold">Google Play</p>
              <p className="mt-1 text-sm text-muted">
                Completing in-app purchase for {pack.price}…
              </p>
              <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-ink-3">
                <motion.div
                  className="h-full bg-coral"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.2 }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
