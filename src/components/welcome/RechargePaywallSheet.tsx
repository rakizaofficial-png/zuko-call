"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock3, Sparkles, Zap } from "lucide-react";
import { purchaseCoinPack, loadStorePacks } from "@/services/billing/iap";
import type { CoinPackDto } from "@/services/walletApi";
import { useApp } from "@/lib/store";
import { WELCOME_PUSH_HOST } from "@/lib/welcomePush/config";

/** High-conversion recharge paywall — live IAP packs from API. */
export function RechargePaywallSheet({
  open,
  host = WELCOME_PUSH_HOST,
  offerLeft,
  onClose,
}: {
  open: boolean;
  host?: { name: string };
  offerLeft: number;
  onClose: () => void;
}) {
  const { pushToast, refreshWallet } = useApp();
  const [packs, setPacks] = useState<CoinPackDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadStorePacks()
      .then((p) => setPacks(p.slice(0, 3)))
      .catch(() => setPacks([]));
  }, [open]);

  const buy = async (pack: CoinPackDto) => {
    setBusy(pack.id);
    pushToast("Opening Google Play / App Store…");
    const result = await purchaseCoinPack(pack);
    setBusy(null);
    if (!result.ok) {
      pushToast(result.error);
      return;
    }
    await refreshWallet();
    pushToast(`You’re back — call ${host.name} now 💖`);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[110] bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-1/2 z-[120] w-full max-w-[430px] -translate-x-1/2 rounded-t-[1.75rem] border border-cyan/30 bg-[#0a0812] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-30px_80px_rgba(255,42,122,0.25)]"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-cyan/40" />
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
              <Zap className="h-3.5 w-3.5" /> Connection dropped
            </p>
            <h2 className="mt-1 font-display text-[1.35rem] font-extrabold leading-snug text-sand">
              {host.name} is waiting for you! 💖 Connection dropped due to 0
              Coins.
            </h2>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-gold">
                <Clock3 className="h-3.5 w-3.5" />
                Offer expires in {String(offerLeft).padStart(2, "0")}s
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {packs.map((pack, i) => (
                <motion.button
                  key={pack.id}
                  type="button"
                  disabled={!!busy}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i }}
                  onClick={() => void buy(pack)}
                  className="relative flex w-full items-center gap-3 rounded-2xl border border-coral/50 bg-coral/15 px-4 py-4 text-left shadow-[0_0_28px_rgba(255,42,122,0.35)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-gold">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-sand">
                      {pack.coins} Coins
                      {pack.bonus ? ` +${pack.bonus}` : ""}
                    </p>
                    <p className="text-[11px] text-white/65">
                      {pack.popular ? "Popular · " : ""}
                      {pack.sku}
                    </p>
                  </div>
                  <span className="font-display text-xl font-extrabold text-cyan">
                    {busy === pack.id ? "…" : pack.priceLabel}
                  </span>
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-2 text-center text-xs font-semibold text-white/45"
            >
              Maybe later
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
