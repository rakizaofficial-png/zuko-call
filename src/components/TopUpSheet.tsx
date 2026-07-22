"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Coins, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { IAP_PRODUCTS, type IapProduct } from "@/lib/payments/iapCatalog";
import { purchaseCoins } from "@/lib/payments/iap";
import { useApp } from "@/lib/store";

/**
 * Play-policy checkout — digital coins must use Google Play Billing.
 * UI mirrors a modern payment-method picker, but only Play-compliant methods.
 */
type PayMethod = {
  id: "google_play" | "google_play_promo";
  label: string;
  sub: string;
  badge?: string;
  recommended?: boolean;
};

const PAY_METHODS: PayMethod[] = [
  {
    id: "google_play",
    label: "Google Play",
    sub: "Official Play Billing · secure",
    recommended: true,
    badge: "Recommended",
  },
  {
    id: "google_play_promo",
    label: "Google Play · Promo",
    sub: "Same Play Billing · bonus packs",
    badge: "Best value",
  },
];

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
  const { userId, pushToast, syncWallet } = useApp();
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>(
    IAP_PRODUCTS.find((p) => p.popular)?.productId || IAP_PRODUCTS[0]!.productId,
  );
  const [method, setMethod] = useState<PayMethod["id"]>("google_play");

  const product: IapProduct =
    IAP_PRODUCTS.find((p) => p.productId === selectedProduct) || IAP_PRODUCTS[0]!;
  const totalCoins = product.coins + product.bonusCoins;

  const methods = useMemo(() => PAY_METHODS, []);

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
            className="fixed bottom-0 left-1/2 z-[75] max-h-[92dvh] w-full max-w-[430px] -translate-x-1/2 overflow-y-auto rounded-t-[1.75rem] border border-cyan/35 bg-[#0a0812]/98 px-4 pt-4 shadow-[0_-24px_80px_rgba(0,240,255,0.18)] backdrop-blur-xl safe-footer"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan/40" />
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan">
                  <Zap className="h-3.5 w-3.5" /> Checkout
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-sand">
                  {warningMessage ? "Balance running low" : "Recharge coins"}
                </h3>
                <p className="mt-1 text-xs text-cyan/80">
                  You will get{" "}
                  <span className="font-bold text-gold">
                    {totalCoins.toLocaleString()}
                  </span>{" "}
                  coins
                  {minuteRate ? ` · calls from ${minuteRate}/min` : ""}
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

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted">
              Coin pack
            </p>
            <div className="mt-2 space-y-2">
              {IAP_PRODUCTS.map((tier) => {
                const total = tier.coins + tier.bonusCoins;
                const active = tier.productId === selectedProduct;
                return (
                  <button
                    key={tier.productId}
                    type="button"
                    onClick={() => setSelectedProduct(tier.productId)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                      active
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10 bg-ink-2/80"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                      {tier.popular ? (
                        <Sparkles className="h-5 w-5 text-gold" />
                      ) : (
                        <Coins className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-sand">
                        {tier.title}
                        {tier.popular ? (
                          <span className="ml-2 rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold text-white">
                            Popular
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-cyan/75">
                        {total.toLocaleString()} coins
                        {tier.bonusCoins ? ` · +${tier.bonusCoins} bonus` : ""}
                      </p>
                    </div>
                    <span className="font-display text-base font-extrabold text-cyan">
                      {tier.priceLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Payment · Google Play policy
            </p>
            <div className="mt-2 space-y-2">
              {methods.map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left ${
                      active
                        ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        active
                          ? "border-emerald-400 bg-emerald-500 text-white"
                          : "border-white/30"
                      }`}
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-sand">
                        {m.label}
                        {m.badge ? (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            {m.badge}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-white/55">{m.sub}</p>
                    </div>
                    <span className="font-display text-sm font-extrabold text-sand">
                      {product.priceLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-white/45">
              Virtual coins are digital goods. Per Google Play policy, Zuko uses
              Google Play Billing only — not third-party wallets (JazzCash /
              EasyPaisa / cards outside Play).
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Price
                </p>
                <p className="font-display text-xl font-extrabold text-sand">
                  {product.priceLabel}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void payNow()}
                className="min-w-[9.5rem] rounded-2xl bg-emerald-500 px-5 py-3.5 font-display text-base font-extrabold text-ink shadow-[0_8px_28px_rgba(16,185,129,0.45)] disabled:opacity-60"
              >
                {busy ? "…" : "Pay now"}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-2 text-center text-xs font-semibold text-white/50"
            >
              Recharge later
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
