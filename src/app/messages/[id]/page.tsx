"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, Send, Video } from "lucide-react";
import { getCreator, threads } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";

const starter = [
  { from: "them", text: "Hey you ✨ glad you wrote" },
  { from: "me", text: "Your energy on live was unreal" },
  { from: "them", text: "Aww thank you! Want a private call later?" },
];

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const thread = threads.find((t) => t.id === id) ?? threads[0];
  const creator = getCreator(thread.creatorId);
  const { spend } = useApp();
  const [messages, setMessages] = useState(starter);
  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "me", text: text.trim() }]);
    setText("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          from: "them",
          text: "Haha love that — talk soon? 💫",
        },
      ]);
    }, 900);
  };

  const unlockPhoto = () => {
    spend(40, "Unlocked a photo 📸");
  };

  return (
    <main className="flex min-h-dvh flex-col bg-ink">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/90 px-3 py-3 backdrop-blur-xl pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/messages" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Image
          src={creator.image}
          alt={creator.name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight">{creator.name}</p>
          <p className="text-[11px] text-teal">
            {creator.online ? "Online now" : "Last seen recently"}
          </p>
        </div>
        <Link
          href={`/call/${creator.id}`}
          className="rounded-full bg-coral p-2.5"
        >
          <Video className="h-4 w-4" />
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.from === "me"
                  ? "rounded-br-md bg-coral text-white"
                  : "rounded-bl-md bg-ink-3 text-sand"
              }`}
            >
              {m.text}
            </p>
          </motion.div>
        ))}

        <button
          type="button"
          onClick={unlockPhoto}
          className="mx-auto flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-ink-2 px-4 py-6"
        >
          <span className="text-2xl">🔒</span>
          <span className="text-xs font-semibold">
            Unlock exclusive snap · 40 coins
          </span>
        </button>
      </div>

      <div className="border-t border-line bg-ink-2/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="rounded-full bg-ink-3 p-2.5 text-gold"
          >
            <Gift className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Write something that lands…"
            className="flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-sm outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={send}
            className="rounded-full bg-sand p-2.5 text-ink"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} />
    </main>
  );
}
