"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { IAP_PRODUCTS, type IapProduct } from "@/lib/payments/iapCatalog";
import { purchaseCoins } from "@/lib/payments/iap";
import { useApp } from "@/lib/store";

/**
 * TikTok-style recharge sheet — large coin packs, animated cards, Play Billing.
 */
export function TopUpSheet({
  open,
  onClose,
  graceLeft,
  minuteRate,
  warningMessage,
}: {
  open: boolean;
  onClose: () => void;
  graceLeft?: number;
  minuteRate?: number;
  warningMessage?: string;
}) {
  const { userId, coins, pushToast, syncWallet } = useApp();
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>(
    IAP_PRODUCTS.find((p) => p.popular)?.productId || IAP_PRODUCTS[0]!.productId,
  );

  const product: IapProduct =
    IAP_PRODUCTS.find((p) => p.productId === selectedProduct) || IAP_PRODUCTS[0]!;
  const totalCoins = product.coins + product.bonusCoins;

  const payNow = async () => {
    if (!userId) {
      pushToast("Wallet not ready — retry in a moment");
      return;
    }
    setBusy(true);
    try {
      const result = await purchaseCoins({
        userId,
        productId: product.productId,
      });
      if ("redirected" in result) {
        pushToast("Opening Google Play checkout…");
        return;
      }
      await syncWallet();
      pushToast(`+${result.credited} coins added`);
      onClose();
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close top-up"
            className="fixed inset-0 z-[70] bg-black/60"
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
            className="fixed bottom-0 left-1/2 z-[75] max-h-[92dvh] w-full max-w-[430px] -translate-x-1/2 overflow-y-auto rounded-t-[1.75rem] border border-gold/30 bg-gradient-to-b from-[#1a1208] via-[#0a0812] to-[#06040b] px-4 pt-4 shadow-[0_-24px_80px_rgba(255,184,0,0.18)] backdrop-blur-xl safe-footer"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gold/50" />

            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                  <Zap className="h-3.5 w-3.5" /> Recharge
                </p>
                <h3 className="mt-1 font-display text-2xl font-extrabold text-sand">
                  {warningMessage && /insufficient/i.test(warningMessage)
                    ? "Insufficient Coins"
                    : "Get coins"}
                </h3>
                {warningMessage ? (
                  <p className="mt-1 text-xs text-rose-300/90">{warningMessage}</p>
                ) : (
                  <p className="mt-1 text-xs text-white/55">
                    Balance{" "}
                    <span className="font-bold text-gold">
                      {coins.toLocaleString()}
                    </span>
                    {minuteRate ? ` · from ${minuteRate}/min` : ""}
                    {graceLeft != null ? ` · ${graceLeft}s grace` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 bg-ink-3 p-2 text-sand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {IAP_PRODUCTS.map((tier, i) => {
                const total = tier.coins + tier.bonusCoins;
                const active = tier.productId === selectedProduct;
                return (
                  <motion.button
                    key={tier.productId}
                    type="button"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedProduct(tier.productId)}
                    className={`relative overflow-hidden rounded-2xl border px-3 py-3.5 text-left transition active:scale-[0.98] ${
                      active
                        ? "border-gold bg-gradient-to-br from-gold/25 via-coral/10 to-ink-2 shadow-[0_0_24px_rgba(255,184,0,0.25)]"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    {tier.popular ? (
                      <span className="absolute right-2 top-2 rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold text-white">
                        Popular
                      </span>
                    ) : null}
                    {tier.best ? (
                      <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        Best
                      </span>
                    ) : null}
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
                      {tier.popular || tier.best ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                    </span>
                    <p className="mt-2 font-display text-xl font-extrabold tabular-nums text-sand">
                      {tier.title}
                    </p>
                    <p className="text-[11px] text-gold/90">
                      {total.toLocaleString()} coins
                      {tier.bonusCoins
                        ? ` · +${tier.bonusCoins} bonus`
                        : ""}
                    </p>
                    <p className="mt-1 font-display text-sm font-bold text-cyan">
                      {tier.priceLabel}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Google Play Billing · secure
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() => void payNow()}
              className="mt-3 mb-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber-400 to-coral font-display text-lg font-extrabold text-ink shadow-[0_8px_32px_rgba(255,184,0,0.35)] disabled:opacity-60"
            >
              {busy
                ? "…"
                : warningMessage && /insufficient/i.test(warningMessage)
                  ? `Recharge · ${product.priceLabel}`
                  : `Pay ${product.priceLabel} · ${totalCoins.toLocaleString()} coins`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mb-2 w-full py-2 text-center text-xs font-semibold text-white/45"
            >
              Not now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
