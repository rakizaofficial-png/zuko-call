"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, ImagePlus, Send, Smile, Video } from "lucide-react";
import { resolveLiveCreator, threads } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { VipChatBubble } from "@/components/VipChatBubble";
import { WalletDiamond } from "@/components/WalletDiamond";
import {
  listDmThreads,
  listenDmRealtime,
  markDmRead,
  openDmWithHost,
  sendDmMessage,
  syncDmFromApi,
  threadIdForHost,
  type DmMessage,
} from "@/lib/dmStore";
import { fetchLiveHosts } from "@/lib/api";
import { hostFromId } from "@/lib/discoverHosts";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";
import { getDeviceUserId } from "@/lib/walletApi";

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { vipTier, triggerEntranceBlast, pushToast } = useApp();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [hostTyping, setHostTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [hostMeta, setHostMeta] = useState({
    id: "",
    name: "Host",
    image: "",
    online: true,
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const userId = useMemo(() => getDeviceUserId(), []);
  const EMOJIS = ["😀", "😍", "🔥", "💕", "😘", "✨", "🎉", "👋", "🥰", "😎"];

  useEffect(() => {
    let cancelled = false;
    let offRt: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      let hostId = id.startsWith("dm_") ? id.slice(3) : "";
      let name = "Host";
      let image = pickHostAvatarUrl({}, { hostId: hostId || id, name: "Host" });
      let online = true;

      if (id.startsWith("dm_")) {
        markDmRead(id);
        try {
          const live = await fetchLiveHosts();
          const h = hostFromId(hostId, live);
          name = h.name;
          image = h.avatarUrl;
          online = h.online || h.live;
        } catch {
          const t = listDmThreads().find((x) => x.id === id);
          if (t) {
            name = t.hostName;
            image = t.hostAvatar;
          }
        }
        openDmWithHost({ hostId, hostName: name, hostAvatar: image });
      } else {
        const thread = threads.find((t) => t.id === id) ?? threads[0]!;
        const creator = resolveLiveCreator(thread.creatorId);
        hostId = creator.id;
        name = creator.name;
        image = creator.image;
        online = creator.online;
        openDmWithHost({
          hostId,
          hostName: name,
          hostAvatar: image,
        });
      }

      if (cancelled || !hostId) return;
      setHostMeta({ id: hostId, name, image, online });
      // Viewing this thread clears its unread (covers seed→DM conversions too).
      markDmRead(threadIdForHost(hostId));

      const synced = await syncDmFromApi(hostId);
      if (!cancelled) setMessages(synced);

      offRt = listenDmRealtime(hostId, userId, (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Message arrived while the thread is open → keep it read.
        markDmRead(threadIdForHost(hostId));
      });
      poll = setInterval(() => {
        void syncDmFromApi(hostId).then((rows) => {
          if (!cancelled) setMessages(rows);
        });
      }, 4000);
    })();

    return () => {
      cancelled = true;
      offRt?.();
      if (poll) clearInterval(poll);
    };
  }, [id, userId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, hostTyping]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);

  const send = async (payload?: string, imageUrl?: string) => {
    const outgoing = (payload ?? text).trim();
    if ((!outgoing && !imageUrl) || !hostMeta.id || sending) return;
    if (vipTier === "diamond") triggerEntranceBlast();
    setSending(true);
    const tid = openDmWithHost({
      hostId: hostMeta.id,
      hostName: hostMeta.name,
      hostAvatar: hostMeta.image,
    });
    if (!payload) setText("");
    setEmojiOpen(false);
    try {
      const { mine } = await sendDmMessage(
        tid,
        outgoing || "📷 Photo",
        {
          hostId: hostMeta.id,
          hostName: hostMeta.name,
          hostAvatar: hostMeta.image,
          imageUrl,
        },
      );
      setMessages((m) => {
        if (m.some((x) => x.id === mine.id)) return m;
        return [...m.filter((x) => !x.id.startsWith("local_")), mine];
      });
      setHostTyping(true);
      window.setTimeout(() => setHostTyping(false), 1600);
    } catch (e) {
      if (!payload) setText(outgoing);
      pushToast?.(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_500_000) {
      pushToast("Image too large — keep under 2.5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      void send("📷 Photo", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#06040b]">
      <header className="safe-header z-20 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#06040b]/95 px-3 py-3 backdrop-blur-xl">
        <Link href="/messages" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link
          href={`/host/${encodeURIComponent(hostMeta.id || "x")}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <HostAvatarImg
            src={pickHostAvatarUrl(
              { avatarUrl: hostMeta.image },
              { hostId: hostMeta.id || id, name: hostMeta.name },
            )}
            hostId={hostMeta.id || id}
            name={hostMeta.name}
            alt={hostMeta.name}
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
          href={`/call/${encodeURIComponent(hostMeta.id || id)}?live=1`}
          className="rounded-full bg-[#ff9f1a] p-2.5"
        >
          <Video className="h-4 w-4 text-black" />
        </Link>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[85%]">
              {m.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageUrl}
                  alt="Shared"
                  className="mb-1 max-h-52 w-full rounded-2xl object-cover ring-1 ring-white/15"
                />
              ) : null}
              <VipChatBubble tier={vipTier} fromMe={m.from === "me"}>
                {m.text}
              </VipChatBubble>
              {m.from === "me" ? (
                <p className="mt-0.5 text-right text-[10px] text-white/40">
                  {m.read === false ? "Sent" : "Read"}
                </p>
              ) : null}
            </div>
          </motion.div>
        ))}
        {hostTyping ? (
          <p className="text-xs text-white/45">{hostMeta.name} is typing…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div
        className="safe-footer shrink-0 border-t border-white/10 bg-ink-2/95 px-3 py-3"
        style={{ paddingBottom: "max(0.75rem, var(--kb-inset, 0px))" }}
      >
        {emojiOpen ? (
          <div className="mb-2 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-[#06040b] p-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((t) => t + e)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="rounded-full bg-ink-3 p-2.5 text-gold"
            aria-label="Gift"
          >
            <Gift className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="rounded-full bg-ink-3 p-2.5 text-sand"
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-ink-3 p-2.5 text-sand"
            aria-label="Share image"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickImage(e)}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Write a message…"
            disabled={sending}
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#06040b] px-4 py-2.5 text-sm text-sand outline-none placeholder:text-white/35 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="rounded-full bg-[#ff9f1a] p-2.5 text-black disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/35">
          Secure chat · host sees this in CoinCall
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
