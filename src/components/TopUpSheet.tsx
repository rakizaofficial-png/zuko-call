"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Sparkles, X, Zap } from "lucide-react";
import { purchaseCoinPack, loadStorePacks } from "@/services/billing/iap";
import type { CoinPackDto } from "@/services/walletApi";
import { useApp } from "@/lib/store";

/**
 * Production top-up sheet — packs from API, purchase via IAP / Play Billing.
 */
export function TopUpSheet({
  open,
  onClose,
  graceLeft,
  minuteRate,
}: {
  open: boolean;
  onClose: () => void;
  graceLeft?: number;
  minuteRate?: number;
}) {
  const { pushToast, refreshWallet } = useApp();
  const [packs, setPacks] = useState<CoinPackDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadStorePacks()
      .then(setPacks)
      .catch(() => setPacks([]));
  }, [open]);

  const buy = async (pack: CoinPackDto) => {
    setBusy(pack.id);
    pushToast("Opening store billing…");
    const result = await purchaseCoinPack(pack);
    setBusy(null);
    if (!result.ok) {
      pushToast(result.error);
      return;
    }
    if (result.walletCoins >= 0) {
      await refreshWallet();
      pushToast(`+${pack.coins} coins added`);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close top-up"
            className="fixed inset-0 z-[70] bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-1/2 z-[75] w-full max-w-[430px] -translate-x-1/2 rounded-t-[1.75rem] border border-cyan/35 bg-[#0a0812]/98 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_80px_rgba(0,240,255,0.18)] backdrop-blur-xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan/40" />
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan">
                  <Zap className="h-3.5 w-3.5" /> Live wallet recharge
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-sand">
                  Google Play / App Store
                </h3>
                <p className="mt-1 text-xs text-cyan/80">
                  {minuteRate
                    ? `Below 1-minute rate (${minuteRate} coins)`
                    : "Server-verified IAP"}
                  {graceLeft != null ? ` · ${graceLeft}s grace` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-cyan/25 bg-ink-3 p-2 text-cyan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {packs.length === 0 && (
                <p className="rounded-2xl border border-cyan/20 bg-ink-2 px-4 py-6 text-center text-sm text-cyan/70">
                  Loading store packs from API…
                </p>
              )}
              {packs.slice(0, 3).map((pack, i) => (
                <motion.button
                  key={pack.id}
                  type="button"
                  disabled={busy === pack.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => void buy(pack)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-cyan/45 bg-ink-2/90 px-4 py-3.5 text-left shadow-[0_0_24px_rgba(0,240,255,0.2)] disabled:opacity-60"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                    {pack.popular ? (
                      <Sparkles className="h-5 w-5 text-gold" />
                    ) : (
                      <Coins className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-sand">
                      {pack.coins.toLocaleString()} coins
                      {pack.bonus ? ` +${pack.bonus}` : ""}
                    </p>
                    <p className="text-[11px] text-cyan/75">
                      SKU {pack.sku}
                      {pack.popular ? " · Most loved" : ""}
                    </p>
                  </div>
                  <span className="font-display text-lg font-extrabold text-cyan">
                    {busy === pack.id ? "…" : pack.priceLabel}
                  </span>
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] text-cyan/60">
              Receipts verified server-side · call layout stays mounted
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
