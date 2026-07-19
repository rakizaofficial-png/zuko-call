"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, Send, Video } from "lucide-react";
import { getCreator, resolveLiveCreator, threads } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";
import { VipChatBubble } from "@/components/VipChatBubble";
import { WalletDiamond } from "@/components/WalletDiamond";
import {
  appendDmReply,
  getDmMessages,
  listDmThreads,
  markDmRead,
  openDmWithHost,
  sendDmMessage,
  type DmMessage,
} from "@/lib/dmStore";
import { fetchLiveHosts } from "@/lib/api";
import { hostFromId } from "@/lib/discoverHosts";

const REPLIES = [
  "Haha love that — talk soon? 💫",
  "You're sweet ✨",
  "Want a private call later?",
  "Tell me more 👀",
  "I'm free now if you want to call!",
];

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { vipTier, triggerEntranceBlast } = useApp();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [hostMeta, setHostMeta] = useState({
    id: "",
    name: "Host",
    image: "",
    online: true,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // DM thread: dm_{hostId}
      if (id.startsWith("dm_")) {
        const hostId = id.slice(3);
        markDmRead(id);
        let name = "Host";
        let image = `https://i.pravatar.cc/150?u=${encodeURIComponent(hostId)}`;
        let online = true;
        try {
          const live = await fetchLiveHosts();
          const h = hostFromId(hostId, live);
          name = h.name;
          image = h.avatarUrl;
          online = h.online || h.live;
          openDmWithHost({
            hostId,
            hostName: name,
            hostAvatar: image,
          });
        } catch {
          const t = listDmThreads().find((x) => x.id === id);
          if (t) {
            name = t.hostName;
            image = t.hostAvatar;
          }
        }
        if (cancelled) return;
        setHostMeta({ id: hostId, name, image, online });
        setMessages(getDmMessages(id));
        return;
      }

      // Legacy catalog thread
      const thread = threads.find((t) => t.id === id) ?? threads[0]!;
      const creator = resolveLiveCreator(thread.creatorId);
      if (cancelled) return;
      setHostMeta({
        id: creator.id,
        name: creator.name,
        image: creator.image,
        online: creator.online,
      });
      // Migrate into DM store so send works the same
      const tid = openDmWithHost({
        hostId: creator.id,
        hostName: creator.name,
        hostAvatar: creator.image,
      });
      const existing = getDmMessages(tid);
      if (existing.length === 0) {
        setMessages([
          {
            id: "s1",
            from: "them",
            text: "Hey you ✨ glad you wrote",
            at: Date.now() - 60000,
          },
          {
            id: "s2",
            from: "me",
            text: "Your energy on live was unreal",
            at: Date.now() - 30000,
          },
          {
            id: "s3",
            from: "them",
            text: "Aww thank you! Want a private call later?",
            at: Date.now() - 10000,
          },
        ]);
      } else {
        setMessages(existing);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const threadKey = id.startsWith("dm_")
    ? id
    : `dm_${hostMeta.id || getCreator(threads[0]?.creatorId || "")?.id || "host"}`;

  const send = () => {
    if (!text.trim() || !hostMeta.id) return;
    if (vipTier === "diamond") triggerEntranceBlast();
    const tid = openDmWithHost({
      hostId: hostMeta.id,
      hostName: hostMeta.name,
      hostAvatar: hostMeta.image,
    });
    const { mine } = sendDmMessage(tid, text);
    setMessages((m) => [...m, mine]);
    setText("");
    const replyText = REPLIES[Math.floor(Math.random() * REPLIES.length)]!;
    setTimeout(() => {
      const reply = appendDmReply(tid, replyText);
      setMessages((m) => [...m, reply]);
    }, 900);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#06040b]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#06040b]/90 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <Link href="/messages" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link
          href={`/host/${encodeURIComponent(hostMeta.id || "x")}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Image
            src={
              hostMeta.image ||
              `https://i.pravatar.cc/80?u=${encodeURIComponent(id)}`
            }
            alt={hostMeta.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-[#ff9f1a]/40"
          />
          <div className="min-w-0">
            <p className="truncate font-display font-bold leading-tight">
              {hostMeta.name}
            </p>
            <p className="text-[11px] font-semibold text-[#22c55e]">
              {hostMeta.online ? "Online now" : "Last seen recently"}
            </p>
          </div>
        </Link>
        <WalletDiamond compact />
        <Link
          href={`/call/${encodeURIComponent(hostMeta.id || id)}`}
          className="rounded-full bg-[#ff9f1a] p-2.5"
        >
          <Video className="h-4 w-4 text-black" />
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <VipChatBubble tier={vipTier} fromMe={m.from === "me"}>
              {m.text}
            </VipChatBubble>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 bg-ink-2/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="rounded-full bg-ink-3 p-2.5 text-gold"
            aria-label="Gift"
          >
            <Gift className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Write a message…"
            className="flex-1 rounded-full border border-white/10 bg-[#06040b] px-4 py-2.5 text-sm text-sand outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={send}
            className="rounded-full bg-[#ff9f1a] p-2.5 text-black"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/35">
          Chat · {threadKey.replace("dm_", "")}
        </p>
      </div>

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        hostId={hostMeta.id}
      />
    </main>
  );
}
