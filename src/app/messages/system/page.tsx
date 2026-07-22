"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, Bell, Shield } from "lucide-react";
import { ChatShell } from "@/components/chat";

const ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Welcome to Zuko",
    body: "Official system messages appear here. Coins, calls, and gifts are protected by server-side validation.",
    at: "Pinned",
  },
  {
    id: "2",
    title: "Recharge safely",
    body: "Digital coins use Google Play Billing only. Never share OTPs or passwords with anyone claiming to be support.",
    at: "Info",
  },
  {
    id: "3",
    title: "Live & calls",
    body: "Only real hosts appear Live. If a stream ends, it disappears immediately from your Live tab.",
    at: "Info",
  },
];

/**
 * Pinned System Information chat — official verified channel.
 * Always linked from Messages inbox; cannot be reordered or deleted.
 */
export default function SystemInformationPage() {
  return (
    <ChatShell
      scrollKey={ANNOUNCEMENTS.length}
      header={
        <div className="flex items-center gap-3 px-3 py-3">
          <Link href="/messages" className="rounded-full bg-ink-3 p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-display font-bold leading-tight">
              System Information
              <BadgeCheck className="h-4 w-4 text-cyan" />
            </p>
            <p className="text-[11px] font-semibold text-[#25D366]">
              Official · Verified
            </p>
          </div>
        </div>
      }
      footer={
        <p className="px-2 py-1 text-center text-[11px] text-white/40">
          This is a read-only official channel. For help, use Customer Support.
        </p>
      }
    >
      <div className="mb-4 rounded-2xl border border-gold/25 bg-gold/10 px-4 py-3 text-center">
        <Shield className="mx-auto mb-2 h-6 w-6 text-gold" />
        <p className="font-display text-sm font-bold">Zuko System</p>
        <p className="mt-1 text-[11px] text-muted">
          Announcements from the Zuko team. This chat stays pinned at the top of
          Chats.
        </p>
      </div>

      {ANNOUNCEMENTS.map((a) => (
        <div
          key={a.id}
          className="rounded-2xl rounded-bl-md border border-cyan/20 bg-ink-3 px-3.5 py-3"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan">
            <Bell className="h-3 w-3" />
            {a.at}
          </p>
          <p className="mt-1 font-display text-sm font-bold text-sand">
            {a.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">{a.body}</p>
        </div>
      ))}
    </ChatShell>
  );
}
