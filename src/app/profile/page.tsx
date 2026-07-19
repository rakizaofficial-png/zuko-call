"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Crown,
  Flame,
  History,
  Pencil,
  Phone,
  RefreshCw,
  Sparkles,
  Store,
  Trophy,
  UserRound,
} from "lucide-react";
import { DailyCheckInModal } from "@/components/engagement/DailyCheckInModal";
import { LuckySpinModal } from "@/components/engagement/LuckySpinModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { purchaseCoins } from "@/lib/payments/iap";
import type { IapProduct } from "@/lib/payments/iapCatalog";
import {
  fetchUserCallHistory,
  formatCallDuration,
  type CallHistoryRow,
} from "@/lib/callHistoryApi";
import {
  fetchCoinCatalog,
  fetchWalletHistory,
  getDeviceUserId,
  type WalletLedgerEntry,
} from "@/lib/walletApi";
import { shortUserId } from "@/lib/userProfile";
import { nextCheckInReward, spinsRemaining, useApp } from "@/lib/store";
import { vipLabel } from "@/lib/ledger";

/** Modern profile — auto id, wallet, rewards, buy coins on same userId */
export default function ProfilePage() {
  const {
    coins,
    userId,
    displayName,
    avatarUrl,
    ready,
    pushToast,
    syncWallet,
    updateDisplayName,
    isPremium,
    engagement,
    vipTier,
    xp,
  } = useApp();
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<WalletLedgerEntry[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryRow[]>([]);
  const [spinOpen, setSpinOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [historyTab, setHistoryTab] = useState<"calls" | "coins">("calls");

  const checkReward = nextCheckInReward(engagement);
  const spinsLeft = spinsRemaining(engagement);
  const xpPct = Math.min(100, Math.round((engagement.levelXp / 200) * 100));

  useEffect(() => {
    void fetchCoinCatalog().then((list) => {
      setProducts(list as IapProduct[]);
      const popular =
        list.find((p) => p.popular)?.productId || list[0]?.productId || "";
      setSelected(popular);
    });
  }, []);

  useEffect(() => {
    void fetchWalletHistory().then((h) => {
      if (h.length) setHistory(h);
      else setHistory(engagement.coinHistory);
    });
  }, [engagement.coinHistory, coins]);

  useEffect(() => {
    if (!ready || !userId) return;
    void fetchUserCallHistory(40)
      .then((data) => setCallHistory(data.calls))
      .catch(() => setCallHistory([]));
  }, [ready, userId, coins]);

  const pack = products.find((p) => p.productId === selected) || products[0];

  const buyWithStore = async () => {
    const id = userId || getDeviceUserId();
    if (!pack || !id) {
      pushToast("Profile not ready — wait a moment");
      return;
    }
    setBuying(true);
    try {
      const result = await purchaseCoins({
        userId: id,
        productId: pack.productId,
      });
      if ("redirected" in result) {
        pushToast("Opening store checkout…");
        return;
      }
      await syncWallet();
      pushToast(`+${result.credited} coins → ${shortUserId(id)}`);
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  const saveName = async () => {
    await updateDisplayName(nameDraft);
    setEditingName(false);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      pushToast("User ID copied");
    } catch {
      pushToast(userId);
    }
  };

  return (
    <main className="pb-28">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-coral">
            Luma
          </p>
          <h1 className="font-display text-xl font-bold">Profile</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="px-4 pb-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-br from-ink-3 via-ink-2 to-ink p-5"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-coral/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-0 h-28 w-28 rounded-full bg-cyan/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-16 w-16 rounded-2xl bg-ink-3 object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-coral/30 to-gold/20 ring-1 ring-white/10">
                <UserRound className="h-8 w-8 text-sand" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={24}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-1.5 font-display text-sm font-bold outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    className="rounded-xl bg-coral px-3 text-xs font-bold text-white"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(displayName);
                    setEditingName(true);
                  }}
                  className="flex items-center gap-1.5 text-left"
                >
                  <span className="font-display text-lg font-bold">
                    {displayName || "Luma Fan"}
                  </span>
                  <Pencil className="h-3.5 w-3.5 text-muted" />
                </button>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {isPremium ? "VIP" : "Member"} · {vipLabel(vipTier)}
              </p>
              <button
                type="button"
                onClick={() => void copyId()}
                className="mt-1 font-mono text-[10px] text-cyan/80"
              >
                ID {shortUserId(userId)} · tap to copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => void syncWallet()}
              className="rounded-full border border-line bg-ink/50 p-2.5 text-muted hover:text-sand"
              aria-label="Refresh wallet"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Balance{!ready ? " · syncing" : ""}
            </p>
            <p className="mt-0.5 font-display text-4xl font-extrabold tabular-nums tracking-tight">
              {coins.toLocaleString()}
              <span className="ml-2 text-base font-bold text-gold">coins</span>
            </p>
            <p className="mt-1 text-[10px] text-muted">
              Purchases credit this profile ID only
            </p>
          </div>

          <div className="relative mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-bold text-sand">
                Level {engagement.level}
              </span>
              <span className="text-muted">
                {engagement.levelXp}/200 XP · {xp} total
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-coral to-gold"
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Quick actions */}
      <section className="px-4 pb-5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="rounded-2xl border border-coral/25 bg-coral/10 p-3.5 text-left transition hover:bg-coral/15"
          >
            <Flame className="h-5 w-5 text-coral" />
            <p className="mt-2 font-display text-sm font-bold">Daily</p>
            <p className="text-[10px] text-muted">
              {engagement.checkInClaimedToday
                ? `Streak ${engagement.streak}`
                : `+${checkReward} coins`}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setSpinOpen(true)}
            className="rounded-2xl border border-gold/25 bg-gold/10 p-3.5 text-left transition hover:bg-gold/15"
          >
            <Sparkles className="h-5 w-5 text-gold" />
            <p className="mt-2 font-display text-sm font-bold">Lucky Spin</p>
            <p className="text-[10px] text-muted">
              {spinsLeft} left today
            </p>
          </button>
        </div>

        <div className="mt-2.5 space-y-2">
          <Link
            href="/premium"
            className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 to-transparent px-3.5 py-3.5"
          >
            <Crown className="h-5 w-5 shrink-0 text-gold" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">
                {isPremium ? "VIP active" : "Go VIP"}
              </span>
              <span className="text-[11px] text-muted">
                Discounts · priority matching
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
          <Link
            href="/rewards"
            className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2/60 px-3.5 py-3.5"
          >
            <Trophy className="h-5 w-5 shrink-0 text-coral" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">
                Missions
              </span>
              <span className="text-[11px] text-muted">
                Badges · referral · weekly goals
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        </div>
      </section>

      {/* Buy coins */}
      <section className="px-4 pb-5">
        <h2 className="mb-3 font-display text-sm font-bold">Buy coins</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {products.map((p) => {
            const total = p.coins + p.bonusCoins;
            const active = selected === p.productId;
            return (
              <button
                key={p.productId}
                type="button"
                onClick={() => setSelected(p.productId)}
                className={`relative rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? "border-coral bg-coral/15"
                    : "border-line bg-ink-2/50 hover:border-line"
                }`}
              >
                {p.popular ? (
                  <span className="absolute -top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold text-ink">
                    Best
                  </span>
                ) : null}
                <p className="font-display text-sm font-bold">{p.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {total.toLocaleString()}
                  {p.bonusCoins ? ` · +${p.bonusCoins}` : ""}
                </p>
                <p className="mt-2 font-display text-base font-extrabold text-cyan">
                  {p.priceLabel}
                </p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!pack || buying}
          onClick={() => void buyWithStore()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Store className="h-4 w-4" />
          {buying ? "Processing…" : "Buy with store"}
        </button>
      </section>

      {/* History */}
      <section className="px-4 pb-10">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setHistoryTab("calls")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${
              historyTab === "calls"
                ? "bg-coral text-white"
                : "border border-line bg-ink-2/50 text-muted"
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            Call History
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab("coins")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${
              historyTab === "coins"
                ? "bg-coral text-white"
                : "border border-line bg-ink-2/50 text-muted"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Coin history
          </button>
        </div>

        {historyTab === "calls" ? (
          <ul className="space-y-2">
            {callHistory.map((c) => {
              const when = new Date(c.startedAt || c.endedAt);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-line bg-ink-2/40 px-3.5 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {c.hostName || "Host"}
                      </p>
                      <p className="text-[10px] text-muted">
                        {when.toLocaleDateString()} · {when.toLocaleTimeString()}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        Duration {formatCallDuration(c.durationSec)} ·{" "}
                        {c.billedMinutes} min billed
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-sm font-extrabold text-coral">
                      −{c.coinsSpent}
                    </p>
                  </div>
                </li>
              );
            })}
            {!callHistory.length ? (
              <p className="py-6 text-center text-xs text-muted">
                No calls yet
              </p>
            ) : null}
          </ul>
        ) : (
          <ul className="space-y-2">
            {(history.length ? history : engagement.coinHistory)
              .slice(0, 12)
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-ink-2/40 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold">{e.reason}</p>
                    <p className="text-[10px] text-muted">
                      {new Date(e.at).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={`font-display text-sm font-extrabold ${
                      e.kind === "credit" ? "text-teal" : "text-coral"
                    }`}
                  >
                    {e.kind === "credit" ? "+" : "−"}
                    {e.amount}
                  </p>
                </li>
              ))}
            {!history.length && !engagement.coinHistory.length ? (
              <p className="py-6 text-center text-xs text-muted">
                No transactions yet
              </p>
            ) : null}
          </ul>
        )}
      </section>

      <LuckySpinModal open={spinOpen} onClose={() => setSpinOpen(false)} />
      <DailyCheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
      />
    </main>
  );
}
