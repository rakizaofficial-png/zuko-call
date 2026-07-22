"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Heart,
  History,
  ImageUp,
  LifeBuoy,
  LogIn,
  Pencil,
  Phone,
  RefreshCw,
  Settings,
  Sparkles,
  Store,
  Trophy,
  UserPlus,
  UserRound,
} from "lucide-react";
import { getSession, type AuthSession } from "@/lib/authSession";
import { DailyCheckInModal } from "@/components/engagement/DailyCheckInModal";
import { LuckySpinModal } from "@/components/engagement/LuckySpinModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { purchaseCoins } from "@/lib/payments/iap";
import type { IapProduct } from "@/lib/payments/iapCatalog";
import {
  fetchUserCallHistory,
  type CallHistoryRow,
} from "@/lib/callHistoryApi";
import {
  fetchCoinCatalog,
  fetchWalletHistory,
  getDeviceUserId,
  type WalletLedgerEntry,
} from "@/lib/walletApi";
import { numericLumaId, avatarStyleOptions } from "@/lib/userProfile";
import { nextCheckInReward, spinsRemaining, useApp } from "@/lib/store";
import { vipLabel } from "@/lib/ledger";

async function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("decode failed"));
    img.src = dataUrl;
  });
}

function SummaryCard({
  href,
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gold" | "coral" | "cyan";
}) {
  const ring =
    tone === "gold"
      ? "border-gold/25 bg-gold/8"
      : tone === "coral"
        ? "border-coral/25 bg-coral/8"
        : tone === "cyan"
          ? "border-cyan/25 bg-cyan/8"
          : "border-line bg-ink-2/70";
  return (
    <Link
      href={href}
      className={`flex flex-col rounded-2xl border p-3.5 transition active:scale-[0.98] ${ring}`}
    >
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-ink/40 text-sand">
        {icon}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-extrabold tabular-nums leading-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-muted">{hint}</p> : null}
    </Link>
  );
}

/** Premium profile hub — summary cards only; history on dedicated pages */
export default function ProfilePage() {
  const {
    coins,
    userId,
    displayName,
    avatarUrl,
    ready,
    clientReady,
    pushToast,
    syncWallet,
    updateDisplayName,
    updateAvatar,
    isPremium,
    engagement,
    vipTier,
    xp,
  } = useApp();
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [buying, setBuying] = useState(false);
  const [coinRows, setCoinRows] = useState<WalletLedgerEntry[]>([]);
  const [callRows, setCallRows] = useState<CallHistoryRow[]>([]);
  const [spinOpen, setSpinOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const level = clientReady ? engagement.level : 1;
  const levelXp = clientReady ? engagement.levelXp : 0;
  const totalXp = clientReady ? xp : 0;
  const checkReward = nextCheckInReward(engagement);
  const spinsLeft = clientReady ? spinsRemaining(engagement) : 0;
  const xpPct = Math.min(100, Math.round((levelXp / 200) * 100));
  const balanceLabel = clientReady ? coins : 0;
  const streakLabel = clientReady
    ? engagement.checkInClaimedToday
      ? `Streak ${engagement.streak}`
      : `+${checkReward}`
    : "…";

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
      setCoinRows(h.length ? h : engagement.coinHistory);
    });
  }, [engagement.coinHistory, coins]);

  useEffect(() => {
    if (!ready || !userId) return;
    void fetchUserCallHistory(40)
      .then((data) => setCallRows(data.calls || []))
      .catch(() => setCallRows([]));
  }, [ready, userId, coins]);

  const pack = products.find((p) => p.productId === selected) || products[0];
  const topPacks = products.slice(0, 4);
  const coinsSpentTotal = callRows.reduce((n, c) => n + (c.coinsSpent || 0), 0);
  const callCount = callRows.length;
  const coinTxCount = coinRows.length || engagement.coinHistory.length;

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
      pushToast(`+${result.credited} coins → Zuko ID ${numericLumaId(id)}`);
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

  const onGalleryPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSavingAvatar(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file, 256);
      await updateAvatar(dataUrl);
      setEditingAvatar(false);
    } catch {
      pushToast("Could not load that photo");
    } finally {
      setSavingAvatar(false);
    }
  };

  const pickAvatar = async (url: string) => {
    if (savingAvatar || url === avatarUrl) {
      setEditingAvatar(false);
      return;
    }
    setSavingAvatar(true);
    try {
      await updateAvatar(url);
      setEditingAvatar(false);
    } finally {
      setSavingAvatar(false);
    }
  };

  const lumaId = numericLumaId(userId);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(lumaId);
      pushToast("Zuko ID copied");
    } catch {
      pushToast(lumaId);
    }
  };
  const avatarChoices = avatarStyleOptions(userId || displayName || "luma");

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center justify-between border-b border-line/60 bg-ink/90 px-4 pb-3 backdrop-blur-xl">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-coral">
            Zuko
          </p>
          <h1 className="font-display text-[22px] font-bold leading-tight">
            Profile
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/settings"
            className="rounded-full border border-line bg-ink-2 p-2.5"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Identity card */}
      <section className="px-4 pt-4">
        <motion.div
          initial={false}
          className="relative overflow-hidden rounded-[1.5rem] border border-line bg-gradient-to-br from-ink-3 via-ink-2 to-ink p-4"
        >
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-coral/15 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingAvatar((v) => !v)}
              className="relative shrink-0"
              aria-label="Change photo"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-2xl bg-ink-3 object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral/30 to-gold/20 ring-1 ring-white/10">
                  <UserRound className="h-7 w-7 text-sand" />
                </span>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-white">
                <Pencil className="h-2.5 w-2.5" />
              </span>
            </button>
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
                  <span className="truncate font-display text-lg font-bold">
                    {displayName || "Zuko Fan"}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {isPremium ? "VIP" : "Member"} · {vipLabel(vipTier)} · Lv {level}
              </p>
              <button
                type="button"
                onClick={() => void copyId()}
                className="mt-1 font-mono text-[11px] font-semibold tracking-wide text-cyan/90"
              >
                ID {lumaId}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void syncWallet()}
              className="rounded-full border border-line bg-ink/50 p-2.5 text-muted"
              aria-label="Refresh wallet"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {editingAvatar ? (
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingAvatar}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/35 bg-cyan/10 py-2.5 text-sm font-bold text-cyan disabled:opacity-50"
              >
                <ImageUp className="h-4 w-4" />
                {savingAvatar ? "Uploading…" : "Upload photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onGalleryPick(e)}
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {avatarChoices.map((opt) => (
                  <button
                    key={opt.style}
                    type="button"
                    disabled={savingAvatar}
                    onClick={() => void pickAvatar(opt.url)}
                    className={`shrink-0 overflow-hidden rounded-xl ring-2 ${
                      avatarUrl === opt.url ? "ring-coral" : "ring-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.url}
                      alt={opt.style}
                      className="h-12 w-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-sand">Level {level}</span>
              <span className="text-muted">
                {levelXp}/200 · {totalXp} XP
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-coral to-gold"
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Summary grid */}
      <section className="mt-4 grid grid-cols-2 gap-2.5 px-4">
        <SummaryCard
          href="/wallet"
          icon={<Coins className="h-4 w-4 text-gold" />}
          label="Balance"
          value={balanceLabel.toLocaleString()}
          hint={!ready ? "Syncing…" : "Tap to wallet"}
          tone="gold"
        />
        <SummaryCard
          href="/profile/calls"
          icon={<Phone className="h-4 w-4 text-coral" />}
          label="Calls"
          value={String(callCount)}
          hint={`${coinsSpentTotal.toLocaleString()} coins spent`}
          tone="coral"
        />
        <SummaryCard
          href="/profile/coins"
          icon={<History className="h-4 w-4 text-cyan" />}
          label="Coin history"
          value={String(coinTxCount)}
          hint="Transactions"
          tone="cyan"
        />
        <SummaryCard
          href="/premium"
          icon={<Crown className="h-4 w-4 text-gold" />}
          label="Status"
          value={isPremium ? "VIP" : "Free"}
          hint={vipLabel(vipTier)}
        />
      </section>

      {/* Quick rewards */}
      <section className="mt-4 grid grid-cols-2 gap-2.5 px-4">
        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="rounded-2xl border border-coral/25 bg-coral/10 p-3 text-left"
        >
          <Flame className="h-4 w-4 text-coral" />
          <p className="mt-1.5 font-display text-sm font-bold">Daily</p>
          <p className="text-[10px] text-muted">{streakLabel}</p>
        </button>
        <button
          type="button"
          onClick={() => setSpinOpen(true)}
          className="rounded-2xl border border-gold/25 bg-gold/10 p-3 text-left"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          <p className="mt-1.5 font-display text-sm font-bold">Lucky Spin</p>
          <p className="text-[10px] text-muted">{spinsLeft} left</p>
        </button>
      </section>

      {/* Compact recharge */}
      <section className="mt-4 px-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">Buy coins</h2>
          <Link href="/wallet" className="text-[11px] font-bold text-coral">
            All packs
          </Link>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {topPacks.map((p) => {
            const total = p.coins + p.bonusCoins;
            const active = selected === p.productId;
            return (
              <button
                key={p.productId}
                type="button"
                onClick={() => setSelected(p.productId)}
                className={`rounded-2xl border p-3 text-left ${
                  active
                    ? "border-coral bg-coral/15"
                    : "border-line bg-ink-2/50"
                }`}
              >
                <p className="font-display text-sm font-bold">{p.title}</p>
                <p className="text-[10px] text-muted">
                  {total.toLocaleString()} coins
                </p>
                <p className="mt-1 font-display text-sm font-extrabold text-cyan">
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
          className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-sm font-bold text-white disabled:opacity-50"
        >
          <Store className="h-4 w-4" />
          {buying ? "Processing…" : "Buy with store"}
        </button>
      </section>

      {/* Menu */}
      <section className="mt-4 space-y-2 px-4 pb-6">
        {session ? (
          <div className="rounded-2xl border border-teal/20 bg-teal/5 px-3.5 py-2.5 text-xs">
            Signed in as{" "}
            <span className="font-bold text-sand">{session.user.email}</span>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-coral/35 bg-coral/10 text-xs font-bold text-coral"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}

        {(
          [
            {
              href: "/profile/calls",
              icon: <Phone className="h-5 w-5 text-coral" />,
              title: "Call history",
              sub: "Duration · coins · filters",
            },
            {
              href: "/profile/coins",
              icon: <History className="h-5 w-5 text-cyan" />,
              title: "Coin history",
              sub: "Credits · spends · recharge",
            },
            {
              href: "/favorites",
              icon: <Heart className="h-5 w-5 text-coral" />,
              title: "Favorites",
              sub: "Saved hosts",
            },
            {
              href: "/referral",
              icon: <UserPlus className="h-5 w-5 text-gold" />,
              title: "Invite & earn",
              sub: "Referral rewards",
            },
            {
              href: "/premium",
              icon: <Crown className="h-5 w-5 text-gold" />,
              title: isPremium ? "VIP active" : "Go VIP",
              sub: "Discounts · priority",
            },
            {
              href: "/rewards",
              icon: <Trophy className="h-5 w-5 text-coral" />,
              title: "Missions",
              sub: "Badges · weekly goals",
            },
            {
              href: "/help",
              icon: <LifeBuoy className="h-5 w-5 text-cyan" />,
              title: "Help Center",
              sub: "FAQ · support",
            },
            {
              href: "/settings",
              icon: <Settings className="h-5 w-5 text-muted" />,
              title: "Settings",
              sub: "Language · privacy · logout",
            },
          ] as const
        ).map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2/55 px-3.5 py-3"
          >
            <span className="shrink-0">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">
                {row.title}
              </span>
              <span className="text-[11px] text-muted">{row.sub}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        ))}
      </section>

      <LuckySpinModal open={spinOpen} onClose={() => setSpinOpen(false)} />
      <DailyCheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
      />
    </main>
  );
}
