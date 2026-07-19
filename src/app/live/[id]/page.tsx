"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Gift,
  Heart,
  MessageCircle,
  Video,
} from "lucide-react";
import { fetchLiveHosts } from "@/lib/api";
import { resolveLiveCreator } from "@/lib/data";
import { mergeDiscoverHosts } from "@/lib/discoverHosts";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";

const chatFeed = [
  { user: "Alex", text: "This vibe is unreal 🔥" },
  { user: "Kai", text: "Play that song again!" },
  { user: "Nora", text: "Sent a Rose 🌹" },
  { user: "You", text: "Hey! Just joined ✨" },
];

export default function LiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { coins, following, toggleFollow, spend } = useApp();
  const [creator, setCreator] = useState(() => resolveLiveCreator(id));
  const [giftOpen, setGiftOpen] = useState(false);
  const [likes, setLikes] = useState(0);
  const [viewers, setViewers] = useState(creator.viewers || 1200);
  const [floating, setFloating] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hosts = await fetchLiveHosts();
        const merged = mergeDiscoverHosts(hosts);
        const hit = merged.find((h) => h.id === id);
        if (!cancelled && hit) {
          setCreator(
            resolveLiveCreator(id, {
              name: hit.name,
              image: hit.avatarUrl,
              country: hit.country,
              flag: hit.flag,
              callRate: hit.callRate,
              rating: hit.rating,
              bio: hit.bio,
              tags: hit.tags,
            }),
          );
        }
      } catch {
        /* keep catalog / fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => {
      setViewers((v) => Math.max(1, v + Math.floor(Math.random() * 5) - 1));
    }, 2800);
    return () => clearInterval(t);
  }, []);

  const like = () => {
    setLikes((l) => l + 1);
    setFloating((f) => [...f, "❤️"]);
    setTimeout(() => setFloating((f) => f.slice(1)), 1200);
  };

  const tipSmall = () => {
    if (spend(10, "Rose sent to the room 🌹")) {
      setFloating((f) => [...f, "🌹"]);
      setTimeout(() => setFloating((f) => f.slice(1)), 1200);
    }
  };

  const remoteImg =
    creator.image.includes("pravatar") ||
    creator.image.includes("dicebear") ||
    !creator.image.includes("unsplash");

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink">
      <Image
        src={creator.image}
        alt={creator.name}
        fill
        priority
        className="object-cover"
        unoptimized={remoteImg}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90" />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/live"
              className="rounded-full bg-black/40 p-2 backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur">
              <Image
                src={creator.image}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
                unoptimized={remoteImg}
              />
              <div>
                <p className="text-sm font-bold leading-tight">{creator.name}</p>
                <p className="flex items-center gap-1 text-[10px] text-white/70">
                  <Eye className="h-3 w-3" /> {viewers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFollow(creator.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              following.includes(creator.id)
                ? "bg-white/20 text-white"
                : "bg-coral text-white"
            }`}
          >
            {following.includes(creator.id) ? "Following" : "Follow"}
          </button>
        </div>

        <div className="mt-auto space-y-3">
          <div className="max-h-36 space-y-1.5 overflow-hidden">
            {chatFeed.map((m) => (
              <p key={m.user + m.text} className="text-sm text-white/90">
                <span className="font-bold text-cyan">{m.user}</span> {m.text}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={like}
              className="rounded-full bg-black/45 p-3 backdrop-blur"
            >
              <Heart className="h-5 w-5 text-coral" />
            </button>
            <button
              type="button"
              onClick={tipSmall}
              className="rounded-full bg-black/45 p-3 backdrop-blur"
            >
              <Gift className="h-5 w-5 text-gold" />
            </button>
            <Link
              href={`/call/${creator.id}?live=1`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-coral py-3 text-sm font-bold text-white"
            >
              <Video className="h-4 w-4" /> Private call · {creator.callRate}/min
            </Link>
            <button
              type="button"
              onClick={() => setGiftOpen(true)}
              className="rounded-full bg-black/45 p-3 backdrop-blur"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-white/50">
            {coins.toLocaleString()} coins · {likes} likes
          </p>
        </div>
      </div>

      {floating.map((e, i) => (
        <motion.span
          key={`${e}-${i}`}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -80 }}
          className="pointer-events-none absolute bottom-32 right-8 text-2xl"
        >
          {e}
        </motion.span>
      ))}

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} />
    </main>
  );
}
