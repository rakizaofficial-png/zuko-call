"use client";

import { Crown, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { Gift } from "@/lib/data";

/**
 * Viewer paywall when host locks a live — Unlock sends the required gift.
 */
export function PremiumLiveLockOverlay({
  hostName,
  unlockGift,
  unlockCoins,
  busy,
  onUnlock,
}: {
  hostName: string;
  unlockGift: Gift;
  unlockCoins: number;
  busy?: boolean;
  onUnlock: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 px-6 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex max-w-[20rem] flex-col items-center text-center"
        initial={{ y: 16, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200 shadow-[0_0_32px_rgba(251,191,36,0.35)]">
          <Lock className="h-6 w-6" />
        </span>
        <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-white drop-shadow">
          Enter the Premium live
          <Crown className="h-5 w-5 text-amber-300" />
        </p>
        <p className="mt-2 text-sm text-white/75">
          {hostName} locked this stream. Send a gift to unlock HD video & chat.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85">
          <Sparkles className="h-3 w-3 text-amber-300" />
          Unlock gift · {unlockGift.emoji} {unlockGift.name} · {unlockCoins}+{" "}
          coins
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onUnlock}
          className="mt-6 min-w-[11rem] rounded-full bg-[#ffd400] px-10 py-3.5 font-display text-lg font-extrabold text-black shadow-[0_10px_36px_rgba(255,212,0,0.45)] transition active:scale-95 disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <p className="mt-3 text-[10px] text-white/45">
          Coins are deducted · one gift unlocks this live for you
        </p>
      </motion.div>
    </motion.div>
  );
}
