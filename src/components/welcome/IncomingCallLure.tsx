"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, Crown, Globe2, Phone, PhoneOff, Sparkles } from "lucide-react";
import type { WelcomePushHost } from "@/lib/welcomePush/config";

/**
 * Full-screen incoming call lure — host profile photo only (no background video).
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
      className="fixed inset-0 z-[100] mx-auto flex w-full max-w-[430px] flex-col overflow-hidden bg-[#06040b]"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1.14 }}
        transition={{ duration: 16, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
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

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#06040b]/40 to-[#06040b]/95" />

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

      <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan">
          Luma · Private call
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

      <div className="relative z-10 mt-8 flex flex-1 flex-col items-center px-6">
        <div className="relative">
          <motion.span
            className="absolute -inset-4 rounded-full border-2 border-cyan/50"
            animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.15, 0.75] }}
            transition={{ duration: 1.35, repeat: Infinity }}
          />
          <motion.span
            className="absolute -inset-9 rounded-full border border-coral/35"
            animate={{ scale: [1, 1.22, 1], opacity: [0.55, 0.08, 0.55] }}
            transition={{ duration: 1.75, repeat: Infinity, delay: 0.18 }}
          />
          <motion.div
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <Image
              src={host.avatar}
              alt=""
              width={140}
              height={140}
              className="relative h-[140px] w-[140px] rounded-full object-cover object-top ring-4 ring-cyan/60 shadow-[0_0_40px_rgba(0,240,255,0.45)]"
            />
          </motion.div>

          <div className="absolute -bottom-1 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
            {host.isVerified && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-cyan/40 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-cyan backdrop-blur">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
            {host.isVip && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-gold/50 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-gold backdrop-blur">
                <Crown className="h-3 w-3" /> VIP
              </span>
            )}
          </div>
        </div>

        <motion.h1
          className="mt-7 font-display text-4xl font-extrabold text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.35)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          {host.name}
        </motion.h1>

        <motion.div
          className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span>
            {host.age} · {host.flag} {host.country}
          </span>
          <span className="text-white/30">·</span>
          <span className="inline-flex items-center gap-1 text-cyan/90">
            <Sparkles className="h-3 w-3" /> Lv.{host.level}
          </span>
          {host.isOnline && (
            <>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1 text-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Online
              </span>
            </>
          )}
        </motion.div>

        <motion.p
          className="mt-3 max-w-[18rem] text-center text-sm font-semibold leading-snug text-cyan/95"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          key={host.messageId}
        >
          “{host.message}”
        </motion.p>

        <motion.p
          className="mt-2 max-w-[17rem] text-center text-[11px] text-white/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.34 }}
        >
          {host.bio}
        </motion.p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
            <Globe2 className="h-3 w-3 text-cyan/80" />
            {host.language}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gold/90">
            {host.durationPreview}
          </span>
          {host.interests.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-coral/25 bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-[#ff9ec0]"
            >
              {tag}
            </span>
          ))}
        </div>

        <motion.p
          className="mt-5 text-xs font-bold uppercase tracking-widest text-gold"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.15, repeat: Infinity }}
          key={statusLine}
        >
          {statusLine}
        </motion.p>
      </div>

      <div className="relative z-10 w-full px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="h-1 w-1 animate-ping rounded-full bg-teal" />
          <p className="text-[11px] font-semibold text-white/70">
            Tap Accept to answer · {host.durationPreview}
          </p>
        </div>

        <div className="flex w-full items-stretch gap-3">
          <motion.button
            type="button"
            onClick={onReject}
            whileTap={{ scale: 0.96 }}
            className="flex w-[30%] flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-white/15 bg-white/10 py-5 backdrop-blur-md"
            aria-label="Decline"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.55)]">
              <PhoneOff className="h-7 w-7 text-white" />
            </span>
            <span className="text-xs font-bold text-white/80">Decline</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={onAccept}
            whileTap={{ scale: 0.97 }}
            initial={{ scale: 0.94, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.2 }}
            className="flex w-[70%] flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-emerald-400/50 bg-gradient-to-b from-emerald-400/30 to-emerald-600/40 py-5 shadow-[0_0_40px_rgba(16,185,129,0.45)] backdrop-blur-md"
            aria-label="Accept call"
          >
            <motion.span
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_32px_rgba(16,185,129,0.7)]"
              animate={{
                boxShadow: [
                  "0 0 24px rgba(16,185,129,0.5)",
                  "0 0 40px rgba(16,185,129,0.85)",
                  "0 0 24px rgba(16,185,129,0.5)",
                ],
              }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              <Phone className="h-8 w-8 text-white" fill="currentColor" />
            </motion.span>
            <span className="font-display text-lg font-extrabold text-white">
              Accept
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/90">
              Answer private call
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
