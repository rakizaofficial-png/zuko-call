"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coins, Phone, ShieldCheck, Video, X, Zap } from "lucide-react";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";

/**
 * Pre-call confirmation — rate, balance check, estimated minutes.
 */
export function LivePrivateCallSheet({
  open,
  hostName,
  hostAvatar,
  hostId,
  ratePerMinute,
  balance,
  acceptsCalls,
  acceptReason,
  busy,
  onClose,
  onConfirm,
  onRecharge,
}: {
  open: boolean;
  hostName: string;
  hostAvatar?: string;
  hostId: string;
  ratePerMinute: number;
  balance: number;
  acceptsCalls: boolean;
  acceptReason?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRecharge: () => void;
}) {
  const rate = Math.max(1, Math.floor(ratePerMinute));
  const enough = balance >= rate;
  const minutes = Math.floor(balance / rate);
  const afterOne = Math.max(0, balance - rate);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[80] bg-black/65"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-1/2 z-[85] w-full max-w-[430px] -translate-x-1/2 overflow-hidden rounded-t-[1.75rem] border border-white/15 bg-gradient-to-b from-[#1a1020] to-[#06040b] px-4 pb-6 pt-4 shadow-[0_-24px_80px_rgba(255,42,122,0.2)] safe-footer"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <HostAvatarImg
                  src={hostAvatar}
                  hostId={hostId}
                  name={hostName}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-coral/50"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-lg font-extrabold">
                    <Video className="h-4 w-4 text-coral" />
                    Private Video Call
                  </p>
                  <p className="truncate text-sm text-white/70">
                    with {hostName} · from Live
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/10 p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-gold/30 bg-gold/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold/80">
                  Rate
                </p>
                <p className="mt-1 font-display text-xl font-extrabold text-gold">
                  {rate}
                  <span className="text-sm font-bold"> /min</span>
                </p>
              </div>
              <div className="rounded-2xl border border-cyan/25 bg-cyan/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan/80">
                  Your balance
                </p>
                <p className="mt-1 font-display text-xl font-extrabold text-cyan">
                  {balance.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/75">
                <Coins className="h-3.5 w-3.5 text-gold" />
                After first minute:{" "}
                <span className="font-bold text-sand">
                  {afterOne.toLocaleString()} coins
                </span>
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                Estimated call time:{" "}
                <span className="font-bold text-sand">
                  {enough ? `~${minutes} min` : "0 min"}
                </span>
              </p>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-white/45">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                First minute charged when the host accepts · cancel free while waiting
              </p>
            </div>

            {!acceptsCalls ? (
              <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-xs font-semibold text-rose-200">
                {acceptReason || "Host is not accepting private calls"}
              </p>
            ) : !enough ? (
              <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold text-amber-100">
                Need at least {rate} coins to start. Recharge to continue.
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              {!enough || !acceptsCalls ? (
                <button
                  type="button"
                  onClick={onRecharge}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-coral font-display text-sm font-extrabold text-ink"
                >
                  <Zap className="h-4 w-4" />
                  Recharge
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onConfirm}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan font-display text-sm font-extrabold text-ink disabled:opacity-60"
                >
                  <Phone className="h-4 w-4" />
                  {busy ? "Sending…" : "Video Call"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-2xl border border-white/15 px-4 text-sm font-bold text-white/70"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
