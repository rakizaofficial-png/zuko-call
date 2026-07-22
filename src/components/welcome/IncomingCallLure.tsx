"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, Crown, Globe2, Phone, PhoneOff, Sparkles } from "lucide-react";
import type { WelcomePushHost } from "@/lib/welcomePush/config";

/**
 * Full-screen incoming call lure — host profile photo only (no background video).
 * Single-click Accept / Reject (no loading gates).
 */
export function IncomingCallLure({
  host,
  statusLine = "Ringing…",
  onAccept,
  onReject,
}: {
  host: WelcomePushHost;
  statusLine?: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#06040b]"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1.14 }}
        transition={{
          duration: 16,
          ease: "linear",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <Image
          src={host.avatar}
          alt=""
          fill
          priority
          className="object-cover object-top"
          sizes="430px"
        />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-[#06040b]/45 to-[#06040b]/95" />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full bg-cyan/20 blur-3xl"
        animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.15, 1] }}
        transition={{ duration: 3.2, repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-40 h-48 w-48 rounded-full bg-coral/20 blur-3xl"
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
      />

      <div className="safe-header relative z-10 flex items-center justify-between px-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan">
          Zuko · Private call
        </p>
        <motion.span
          className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/15 px-2.5 py-1 text-[10px] font-bold text-teal"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
          Host calling
        </motion.span>
      </div>

      <div className="relative z-10 mt-8 flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6">
        <div className="relative">
          <motion.span
            className="absolute -inset-4 rounded-full border-2 border-cyan/50"
            animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.15, 0.75] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          <motion.span
            className="absolute -inset-8 rounded-full border border-coral/35"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.05, 0.5] }}
            transition={{ duration: 2.1, repeat: Infinity, delay: 0.25 }}
          />
          <div className="relative h-36 w-36 overflow-hidden rounded-full border-[3px] border-white/90 shadow-[0_0_40px_rgba(255,80,120,0.45)]">
            <Image
              src={host.avatar}
              alt={host.name}
              fill
              priority
              className="object-cover object-top"
              sizes="144px"
            />
          </div>
          {host.isVip ? (
            <span className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink shadow-lg">
              <Crown className="h-4 w-4" />
            </span>
          ) : null}
          {host.isVerified ? (
            <span className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-cyan text-ink shadow-lg">
              <BadgeCheck className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        <motion.h1
          className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {host.name}
          {host.age ? (
            <span className="text-white/70">, {host.age}</span>
          ) : null}
        </motion.h1>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/75">
          <Globe2 className="h-3.5 w-3.5 text-cyan" />
          {host.flag} {host.country}
          <span className="text-white/40">·</span>
          {host.language}
        </p>

        <motion.p
          className="mt-4 max-w-[18rem] text-center text-[15px] font-medium leading-snug text-white/90"
          key={statusLine}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {statusLine}
        </motion.p>

        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">
          <Sparkles className="h-3 w-3 text-gold" />
          {host.durationPreview || "Private video"}
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-center gap-14 px-8 pt-4 safe-footer">
        <button
          type="button"
          onClick={onReject}
          className="flex flex-col items-center gap-2"
          aria-label="Reject call"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40 active:scale-95">
            <PhoneOff className="h-7 w-7" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
            Decline
          </span>
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex flex-col items-center gap-2"
          aria-label="Accept call"
        >
          <motion.span
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 active:scale-95"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          >
            <Phone className="h-7 w-7" />
          </motion.span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
            Accept
          </span>
        </button>
      </div>
    </motion.div>
  );
}
