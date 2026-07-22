"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gift, ImagePlus, Smile, Video } from "lucide-react";
import { resolveLiveCreator, threads } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { WalletDiamond } from "@/components/WalletDiamond";
import {
  ChatBubble,
  ChatComposer,
  ChatImageViewer,
  ChatShell,
  ChatTypingIndicator,
  type ChatMessage,
} from "@/components/chat";
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

const EMOJIS = ["😀", "😍", "🔥", "💕", "😘", "✨", "🎉", "👋", "🥰", "😎"];

function toChatMessage(m: DmMessage): ChatMessage {
  return {
    id: m.id,
    from: m.from,
    text: m.text,
    at: m.at,
    imageUrl: m.imageUrl,
    read: m.read,
  };
}

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [hostMeta, setHostMeta] = useState({
    id: "",
    name: "Host",
    image: "",
    online: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const userId = useMemo(() => getDeviceUserId(), []);

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
      markDmRead(threadIdForHost(hostId));

      const synced = await syncDmFromApi(hostId);
      if (!cancelled) setMessages(synced);

      offRt = listenDmRealtime(hostId, userId, (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
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

  const scrollKey = `${messages.length}:${hostTyping ? 1 : 0}`;

  return (
    <>
      <ChatShell
        scrollKey={scrollKey}
        header={
          <div className="flex items-center gap-3 px-3 py-3">
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
          </div>
        }
        footer={
          <ChatComposer
            value={text}
            onChange={setText}
            onSend={() => void send()}
            sending={sending}
            placeholder="Write a message…"
            emojiOpen={emojiOpen}
            onToggleEmoji={() => setEmojiOpen((v) => !v)}
            onEmojiPick={(e) => setText((t) => t + e)}
            emojis={EMOJIS}
            leading={
              <>
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
              </>
            }
            footerNote="Secure chat · host sees this in CoinCall"
          />
        }
      >
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={toChatMessage(m)}
            vipTier={vipTier}
            onImageClick={setPreviewImage}
          />
        ))}
        {hostTyping ? <ChatTypingIndicator name={hostMeta.name} /> : null}
      </ChatShell>

      <ChatImageViewer url={previewImage} onClose={() => setPreviewImage(null)} />

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        hostId={hostMeta.id}
      />
    </>
  );
}
