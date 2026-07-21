"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Coins,
  Crown,
  Heart,
  Shield,
  Sparkles,
  Timer,
  Video,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/store";

const plans = [
  {
    id: "week",
    name: "VIP Week",
    price: "$4.99",
    period: "/ week",
    coins: 200,
    tag: null as string | null,
  },
  {
    id: "month",
    name: "VIP Month",
    price: "$12.99",
    period: "/ month",
    coins: 800,
    tag: "Most popular",
  },
  {
    id: "year",
    name: "VIP Year",
    price: "$79.99",
    period: "/ year",
    coins: 12000,
    tag: "Best Value",
  },
];

const perks = [
  {
    icon: Video,
    title: "Unlimited matching",
    desc: "Priority queue when hosts are busy",
  },
  {
    icon: Zap,
    title: "Faster connection",
    desc: "Skip the wait — ring hosts first",
  },
  {
    icon: Coins,
    title: "Extra free coins",
    desc: "Welcome pack + cheaper call minutes (−15%)",
  },
  {
    icon: Sparkles,
    title: "Premium hosts",
    desc: "Access VIP-only creators and badges",
  },
  {
    icon: BadgeCheck,
    title: "Exclusive badges",
    desc: "VIP frame in live rooms and chat",
  },
  {
    icon: Heart,
    title: "Priority calls",
    desc: "Half-price instant match (30 vs 60)",
  },
  {
    icon: Shield,
    title: "VIP support",
    desc: "Faster help when something goes wrong",
  },
];

function useOfferCountdown(hours = 6) {
  const [left, setLeft] = useState(hours * 3600);
  useEffect(() => {
    const key = "luma_vip_offer_deadline";
    let deadline = Number(localStorage.getItem(key) || 0);
    const now = Date.now();
    if (!deadline || deadline < now) {
      deadline = now + hours * 3600 * 1000;
      localStorage.setItem(key, String(deadline));
    }
    const tick = () =>
      setLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [hours]);
  const h = String(Math.floor(left / 3600)).padStart(2, "0");
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function PremiumPage() {
  const { isPremium, activatePremium, pushToast, xp, vipTier, openTopUp } =
    useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const countdown = useOfferCountdown(6);

  const subscribe = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId)!;
    setBusy(planId);
    pushToast("VIP requires a verified purchase…");
    try {
      await activatePremium(plan.id, plan.coins);
    } catch {
      openTopUp(30);
      pushToast("Complete a coin purchase to unlock VIP");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main>
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-ink/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <Link href="/" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Zuko VIP
          </p>
          <h1 className="font-display text-xl font-bold">Premium</h1>
        </div>
        {isPremium && (
          <span className="flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-[10px] font-bold text-gold">
            <Crown className="h-3.5 w-3.5" /> Active
          </span>
        )}
      </header>

      <section className="px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/25 via-ink-2 to-coral/15 p-6"
        >
          <div className="absolute -right-4 -top-4 opacity-20">
            <Crown className="h-28 w-28 text-gold" />
          </div>
          <p className="relative flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
            <Zap className="h-3.5 w-3.5" /> Limited-time offer
          </p>
          <h2 className="relative mt-2 font-display text-3xl font-extrabold leading-tight">
            Talk longer.
            <br />
            Connect faster.
          </h2>
          <p className="relative mt-2 max-w-[17rem] text-sm text-muted">
            Unlimited matching, priority calls, premium hosts, extra coins, and
            VIP support. XP {xp} · {vipTier}
          </p>
          {!isPremium ? (
            <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold text-gold backdrop-blur">
              <Timer className="h-3.5 w-3.5" /> Ends in {countdown}
            </p>
          ) : null}
        </motion.div>
      </section>

      {isPremium ? (
        <section className="px-4 pb-6">
          <div className="rounded-2xl border border-teal/30 bg-teal/10 px-4 py-5 text-center">
            <Crown className="mx-auto h-8 w-8 text-gold" />
            <p className="mt-2 font-display text-lg font-bold">
              You’re on Zuko VIP
            </p>
            <p className="mt-1 text-sm text-muted">
              Enjoy discounted calls, priority match, and exclusive badges.
            </p>
            <Link
              href="/call"
              className="mt-4 inline-flex rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white"
            >
              Start a VIP match
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-2.5 px-4 pb-5">
          {plans.map((plan, i) => (
            <motion.button
              key={plan.id}
              type="button"
              disabled={busy !== null}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => void subscribe(plan.id)}
              className={`relative flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left disabled:opacity-60 ${
                plan.tag === "Most popular"
                  ? "border-coral bg-coral/10"
                  : plan.tag === "Best Value"
                    ? "border-gold/50 bg-gold/10"
                    : "border-line bg-ink-2"
              }`}
            >
              {plan.tag && (
                <span
                  className={`absolute -top-2 right-4 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    plan.tag === "Best Value"
                      ? "bg-gold text-ink"
                      : "bg-coral text-white"
                  }`}
                >
                  {plan.tag}
                </span>
              )}
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Crown className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">{plan.name}</p>
                <p className="text-xs text-muted">
                  +{plan.coins.toLocaleString()} welcome coins
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-extrabold">
                  {busy === plan.id ? "…" : plan.price}
                </p>
                <p className="text-[10px] text-muted">{plan.period}</p>
              </div>
            </motion.button>
          ))}
          <p className="pt-1 text-center text-[11px] text-muted">
            Transparent pricing · cancel anytime in store subscriptions
          </p>
        </section>
      )}

      <section className="px-4 pb-10">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted">
          What’s included
        </h3>
        <ul className="space-y-2.5">
          {perks.map((perk, i) => {
            const Icon = perk.icon;
            return (
              <motion.li
                key={perk.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.04 }}
                className="flex gap-3 rounded-2xl border border-line bg-ink-2/80 px-3.5 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-3 text-coral">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">{perk.title}</p>
                  <p className="text-xs text-muted">{perk.desc}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
