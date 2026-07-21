"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, LifeBuoy, Send, ShieldCheck } from "lucide-react";
import {
  getSupportMessages,
  sendSupportMessage,
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportMessage,
} from "@/lib/supportApi";

export default function SupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<SupportCategory>("recharge");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(getSupportMessages());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const outgoing = text.trim();
    setText("");
    try {
      await sendSupportMessage(outgoing, category);
      setMessages(getSupportMessages());
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#06040b]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#06040b]/90 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 text-cyan">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold leading-tight">
            Admin Support
          </p>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[#22c55e]">
            <ShieldCheck className="h-3 w-3" /> Official Zuko help
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-line bg-ink-2/50 px-4 py-3 text-center">
          <p className="font-display text-sm font-bold text-sand">
            How can we help?
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Report recharge failures, technical problems, or ask for help.
            Our team replies right here.
          </p>
        </div>

        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.from === "me"
                  ? "rounded-br-sm bg-[#ff9f1a] text-black"
                  : "rounded-bl-sm border border-cyan/25 bg-ink-2 text-sand"
              }`}
            >
              {m.from === "admin" ? (
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan">
                  <ShieldCheck className="h-3 w-3" /> Support
                </p>
              ) : null}
              {m.text}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 bg-ink-2/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUPPORT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                category === c.id
                  ? "bg-cyan/20 text-cyan ring-1 ring-cyan/40"
                  : "bg-white/8 text-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Describe your issue…"
            disabled={sending}
            className="flex-1 rounded-full border border-white/10 bg-[#06040b] px-4 py-2.5 text-sm text-sand outline-none placeholder:text-white/35 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="rounded-full bg-cyan p-2.5 text-black disabled:opacity-40"
            aria-label="Send to support"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
