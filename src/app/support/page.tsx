"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, ShieldCheck } from "lucide-react";
import {
  getSupportMessages,
  sendSupportMessage,
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportMessage,
} from "@/lib/supportApi";
import {
  ChatBubble,
  ChatComposer,
  ChatShell,
  type ChatMessage,
} from "@/components/chat";

function toChatMessage(m: SupportMessage): ChatMessage {
  return {
    id: m.id,
    from: m.from === "me" ? "me" : "them",
    text: m.text,
    at: m.at,
    senderLabel: m.from === "admin" ? "Support" : undefined,
  };
}

export default function SupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<SupportCategory>("recharge");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMessages(getSupportMessages());
  }, []);

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
    <ChatShell
      scrollKey={messages.length}
      header={
        <div className="flex items-center gap-2.5 px-2.5 py-2.5">
          <Link href="/profile" className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 text-cyan">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              Admin Support
            </p>
            <p className="flex items-center gap-1 text-[12px] font-medium text-[#00a884]">
              <ShieldCheck className="h-3 w-3" /> Official help
            </p>
          </div>
        </div>
      }
      footer={
        <>
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
          <ChatComposer
            value={text}
            onChange={setText}
            onSend={() => void send()}
            sending={sending}
            placeholder="Describe your issue…"
          />
        </>
      }
    >
      <div className="rounded-2xl border border-line bg-ink-2/50 px-4 py-3 text-center">
        <p className="font-display text-sm font-bold text-sand">
          How can we help?
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Report recharge failures, technical problems, or ask for help. Our
          team replies right here.
        </p>
      </div>

      {messages.map((m) => (
        <ChatBubble key={m.id} message={toChatMessage(m)} vipTier="none" variant="support" />
      ))}
    </ChatShell>
  );
}
