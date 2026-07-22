"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bug,
  ChevronDown,
  LifeBuoy,
  MessageSquare,
  ShieldQuestion,
} from "lucide-react";

const FAQS = [
  {
    q: "How do I recharge coins?",
    a: "Open Profile → Buy coins and complete checkout with Google Play Billing. JazzCash/EasyPaisa are not used for virtual coins on Play builds.",
  },
  {
    q: "Why did my call end?",
    a: "Calls end when you hang up, the host leaves, coins run out, or the network drops. Recharge to continue premium video.",
  },
  {
    q: "What does VIP include?",
    a: "VIP unlocks badge, discounts, and priority matching. Renew from the Premium page before expiry.",
  },
  {
    q: "How do referrals work?",
    a: "Share your code from Invite & earn. Friends enter it once; rewards credit when eligible.",
  },
  {
    q: "Is video calling secure?",
    a: "Sessions use encrypted transport (HTTPS/TLS). Tokens are stored on-device; never share your password.",
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan">
            Help Center
          </p>
          <h1 className="font-display text-xl font-bold">FAQ & support</h1>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-2">
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/support"
            className="rounded-2xl border border-cyan/30 bg-cyan/10 p-3.5"
          >
            <LifeBuoy className="h-5 w-5 text-cyan" />
            <p className="mt-2 font-display text-sm font-bold">Live support</p>
            <p className="text-[10px] text-muted">Chat with Zuko admin</p>
          </Link>
          <Link
            href="/support"
            className="rounded-2xl border border-coral/30 bg-coral/10 p-3.5"
          >
            <Bug className="h-5 w-5 text-coral" />
            <p className="mt-2 font-display text-sm font-bold">Report a bug</p>
            <p className="text-[10px] text-muted">Technical issues</p>
          </Link>
          <Link
            href="/support"
            className="rounded-2xl border border-line bg-ink-2/70 p-3.5"
          >
            <MessageSquare className="h-5 w-5 text-sand" />
            <p className="mt-2 font-display text-sm font-bold">Feedback</p>
            <p className="text-[10px] text-muted">Ideas & comments</p>
          </Link>
          <Link
            href="/settings"
            className="rounded-2xl border border-line bg-ink-2/70 p-3.5"
          >
            <ShieldQuestion className="h-5 w-5 text-gold" />
            <p className="mt-2 font-display text-sm font-bold">Privacy</p>
            <p className="text-[10px] text-muted">Security settings</p>
          </Link>
        </div>

        <h2 className="pt-2 font-display text-sm font-bold uppercase tracking-wider text-muted">
          FAQ
        </h2>
        <ul className="space-y-2">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li
                key={item.q}
                className="overflow-hidden rounded-2xl border border-line bg-ink-2/70"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-12 w-full items-center gap-2 px-3.5 py-3 text-left"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-3.5 pb-3 text-xs leading-relaxed text-muted">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
