"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock3, ShieldCheck, Sparkles, Zap } from "lucide-react";
import {
  buildPaywallTiers,
  type WelcomePushHost,
} from "@/lib/welcomePush/config";
import { purchaseCoins } from "@/lib/payments/iap";
import { useApp } from "@/lib/store";

/**
 * High-conversion recharge paywall — opens when free preview ends.
 * Includes explicit "Recharge later" dismiss.
 */
export function RechargePaywallSheet({
  open,
  host,
  offerLeft,
  onClose,
}: {
  open: boolean;
  host: WelcomePushHost;
  offerLeft: number;
  onClose: () => void;
}) {
  const { userId, pushToast, syncWallet, setPremium } = useApp();
  const [busy, setBusy] = useState(false);
  const tiers = buildPaywallTiers(host.name);

  const buy = async (tier: (typeof tiers)[number]) => {
    if (!userId) {
      pushToast("Wallet not ready");
      return;
    }
    const productMap: Record<string, string> = {
      unlock_5: "luma_coins_50",
      popular_50: "luma_coins_50",
      boost_300: "luma_coins_500",
    };
    const productId = productMap[tier.id] || "luma_coins_50";
    setBusy(true);
    pushToast("Opening Google Play checkout…");
    try {
      const result = await purchaseCoins({ userId, productId });
      if ("redirected" in result) return;
      await syncWallet();
      if (tier.id === "boost_300") setPremium(true);
      pushToast(`You’re back — call ${host.name} now`);
      onClose();
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  const neon = (n: "green" | "pink" | "gold") => {
    if (n === "green")
      return "border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_28px_rgba(16,185,129,0.45)] text-emerald-300";
    if (n === "gold")
      return "border-gold/60 bg-gold/15 shadow-[0_0_28px_rgba(255,184,0,0.4)] text-gold";
    return "border-coral/60 bg-coral/20 shadow-[0_0_28px_rgba(255,42,122,0.45)] text-[#ff8fb8]";
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[110] mx-auto max-w-[430px] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center blur-xl brightness-[0.4]"
              style={{ backgroundImage: `url(${host.avatar})` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />
          </motion.div>

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-1/2 z-[120] w-full max-w-[430px] -translate-x-1/2 rounded-t-[1.75rem] border border-cyan/30 bg-[#0a0812]/95 px-4 pt-3 shadow-[0_-30px_80px_rgba(255,42,122,0.25)] backdrop-blur-xl safe-footer"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-cyan/40" />

            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
                  <Zap className="h-3.5 w-3.5" /> Private call paused
                </p>
                <h2 className="mt-1 font-display text-[1.35rem] font-extrabold leading-snug text-sand">
                  Preview ended — recharge to keep talking with {host.name},
                  or recharge later.
                </h2>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2.5 shadow-[0_0_18px_rgba(255,184,0,0.25)]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-gold">
                <Clock3 className="h-3.5 w-3.5" />
                Offer expires in {String(offerLeft).padStart(2, "0")}s
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                <ShieldCheck className="h-3 w-3" /> Google Play
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {tiers.map((tier, i) => (
                <motion.button
                  key={tier.id}
                  type="button"
                  disabled={busy}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i }}
                  onClick={() => void buy(tier)}
                  className={`relative flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left disabled:opacity-60 ${neon(tier.neon)}`}
                >
                  {tier.popular && (
                    <span className="absolute -top-2 right-4 rounded-full bg-coral px-2 py-0.5 text-[9px] font-bold text-white">
                      MOST LOVED
                    </span>
                  )}
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-sand">
                      {tier.headline}
                    </p>
                    <p className="text-[11px] font-medium text-white/65">
                      {tier.sub} · +{tier.coins} coins
                    </p>
                  </div>
                  <span className="font-display text-xl font-extrabold">
                    {tier.price}
                  </span>
                </motion.button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-center text-sm font-bold text-white/80"
            >
              Recharge later
            </button>
            <p className="mt-2 pb-1 text-center text-[10px] text-white/40">
              End call for now · next invite in 1–2 minutes
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
