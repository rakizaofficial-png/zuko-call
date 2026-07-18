"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Coins, Play, Sparkles, Store, Zap } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { purchaseCoinPack, loadStorePacks } from "@/services/billing/iap";
import type { CoinPackDto } from "@/services/walletApi";
import { useApp } from "@/lib/store";

/**
 * Production wallet — balance from API, packs from /wallet/packs, buy via IAP.
 */
export default function WalletPage() {
  const { coins, isPremium, pushToast, refreshWallet, ready } = useApp();
  const [packs, setPacks] = useState<CoinPackDto[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    void loadStorePacks()
      .then((list) => {
        setPacks(list);
        setSelected(
          list.find((p) => p.popular)?.id || list[0]?.id || "",
        );
      })
      .catch(() => pushToast("Could not load store packs"));
  }, [pushToast]);

  const pack = packs.find((p) => p.id === selected) || packs[0];

  const buyWithStore = async () => {
    if (!pack) return;
    setBuying(true);
    pushToast("Opening Google Play / App Store…");
    const result = await purchaseCoinPack(pack);
    setBuying(false);
    if (!result.ok) {
      pushToast(result.error);
      return;
    }
    await refreshWallet();
    pushToast("Purchase verified · coins credited");
  };

  return (
    <main>
      <TopBar
        title="Coin wallet"
        subtitle="Live balance · Play Billing / App Store IAP"
      />

      <section className="px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-cyan/25 bg-ink-2 p-5"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan">
            <Coins className="h-3.5 w-3.5" /> Live balance
            {!ready ? " · syncing…" : ""}
          </p>
          <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-sand">
            {coins.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-cyan/70">
            Server-authoritative wallet · WebSocket sync
          </p>
          <button
            type="button"
            onClick={() => void refreshWallet()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan/30 px-3 py-1.5 text-xs font-bold text-cyan"
          >
            <Zap className="h-3.5 w-3.5" /> Refresh
          </button>
        </motion.div>
      </section>

      <section className="px-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
            Store packs
          </h2>
          <span className="flex items-center gap-1 text-[10px] font-bold text-teal">
            <Store className="h-3 w-3" /> Live SKUs
          </span>
        </div>
        <div className="space-y-2">
          {packs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left ${
                selected === p.id
                  ? "border-cyan/50 bg-cyan/10 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                  : "border-line bg-ink-2"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-3 text-gold">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">
                  {p.coins.toLocaleString()}
                  {p.bonus ? ` +${p.bonus}` : ""} coins
                </p>
                <p className="text-[11px] text-muted">{p.sku}</p>
              </div>
              <span className="font-display font-extrabold text-cyan">
                {p.priceLabel}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!pack || buying}
          onClick={() => void buyWithStore()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 text-sm font-bold text-white shadow-[0_10px_40px_var(--glow)] disabled:opacity-50"
        >
          <Play className="h-4 w-4 fill-current" />
          {buying ? "Processing…" : `Buy with Play / App Store`}
        </button>
        {isPremium && (
          <p className="mt-2 text-center text-[11px] text-gold">
            VIP active · pack bonuses apply after server verify
          </p>
        )}
      </section>

      <section className="px-4 pb-10">
        <Link
          href="/premium"
          className="block rounded-2xl border border-gold/30 bg-gold/10 px-4 py-4 text-center text-sm font-bold text-gold"
        >
          Upgrade VIP Premium
        </Link>
      </section>
    </main>
  );
}
