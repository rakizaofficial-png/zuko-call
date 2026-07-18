"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Zap } from "lucide-react";

export function LowBalanceModal({
  open,
  graceLeft,
  onDismiss,
}: {
  open: boolean;
  graceLeft: number;
  onDismiss?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="rounded-3xl border border-gold/40 bg-ink-2/95 p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
              <Zap className="h-3.5 w-3.5" /> Low balance
            </p>
            <h3 className="mt-1 font-display text-xl font-extrabold">
              Keep the call going
            </h3>
            <p className="mt-1 text-sm text-muted">
              Coins running out. Top up in {graceLeft}s or the call ends.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/wallet"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-coral py-3 text-sm font-bold text-white"
              >
                <Coins className="h-4 w-4" /> 1-tap recharge
              </Link>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-full border border-line px-4 py-3 text-sm font-semibold text-muted"
                >
                  Wait
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
