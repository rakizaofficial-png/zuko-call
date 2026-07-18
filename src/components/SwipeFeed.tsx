"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  Gift,
  Phone,
  Radio,
  Sparkles,
} from "lucide-react";
import { GiftSheet } from "@/components/GiftSheet";
import { VipRibbon } from "@/components/VipRibbon";
import { creators, giftTickerLines, type Creator } from "@/lib/data";
import { fetchLiveHosts, type LiveHost } from "@/lib/api";
import { useApp } from "@/lib/store";

type FeedItem =
  | { kind: "live"; host: LiveHost }
  | { kind: "demo"; creator: Creator };

export function SwipeFeed() {
  const router = useRouter();
  const { isPremium, spend } = useApp();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [giftOpen, setGiftOpen] = useState(false);
  const [ticker, setTicker] = useState(0);
  const [blurOn, setBlurOn] = useState(false);
  const touchY = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const hosts = await fetchLiveHosts();
      if (hosts.length) {
        setItems(hosts.map((h) => ({ kind: "live" as const, host: h })));
        return;
      }
    } catch {
      /* demo fallback */
    }
    setItems(
      creators
        .filter((c) => c.online || c.live)
        .map((c) => ({ kind: "demo" as const, creator: c })),
    );
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(
      () => setTicker((i) => (i + 1) % giftTickerLines.length),
      3200,
    );
    return () => clearInterval(t);
  }, []);

  const current = items[index];
  const next = () => {
    if (!items.length) return;
    setIndex((i) => (i + 1) % items.length);
    setBlurOn(false);
  };
  const prev = () => {
    if (!items.length) return;
    setIndex((i) => (i - 1 + items.length) % items.length);
    setBlurOn(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    if (dy < -48) next();
    if (dy > 48) prev();
    touchY.current = null;
  };

  const callNow = () => {
    if (!current) return;
    if (current.kind === "live") {
      const rate = current.host.ratePerMinute;
      const href = blurOn
        ? `/call/${current.host.id}?live=1&blur=1`
        : `/call/${current.host.id}?live=1`;
      router.push(href);
      return;
    }
    const cost = isPremium ? 30 : 60;
    if (!spend(cost, blurOn ? "Blind match started…" : "Starting call…")) return;
    router.push(
      blurOn
        ? `/call/${current.creator.id}?blur=1`
        : `/call/${current.creator.id}`,
    );
  };

  if (!current) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-6 text-center text-sm text-muted">
        Loading hosts…
      </div>
    );
  }

  const name =
    current.kind === "live" ? current.host.name : current.creator.name;
  const image =
    current.kind === "live"
      ? current.host.avatarUrl ||
        `https://i.pravatar.cc/800?u=${encodeURIComponent(current.host.id)}`
      : current.creator.image;
  const rate =
    current.kind === "live"
      ? current.host.ratePerMinute
      : current.creator.callRate;
  const meta =
    current.kind === "live"
      ? `${current.host.country || "Online"} · ${current.host.isLive ? "LIVE" : "Available"}`
      : `${current.creator.country} ${current.creator.flag} · Lv ${Math.round(current.creator.rating * 20)}`;
  const viewers =
    current.kind === "demo" ? current.creator.viewers : undefined;

  return (
    <div
      className="relative h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] overflow-hidden bg-ink"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={(e) => {
        if (e.deltaY > 30) next();
        if (e.deltaY < -30) prev();
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={
            current.kind === "live"
              ? current.host.id
              : current.creator.id
          }
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.28 }}
          className="absolute inset-0"
        >
          <Image
            src={image}
            alt={name}
            fill
            priority
            className={`object-cover transition duration-700 ${
              blurOn ? "scale-110 blur-2xl brightness-75" : "brightness-90"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/90" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex h-full flex-col px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <VipRibbon />
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-sand backdrop-blur">
            Swipe ↑ next
          </span>
        </div>

        <div className="mt-auto flex items-end gap-3">
          <div className="min-w-0 flex-1 pb-2">
            <div className="mb-2 flex items-center gap-2">
              {current.kind === "live" ||
              (current.kind === "demo" && current.creator.live) ? (
                <span className="live-pulse inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  <Radio className="h-3 w-3" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-bold uppercase text-teal">
                  Online
                </span>
              )}
              {viewers != null && viewers > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/70">
                  <Eye className="h-3 w-3" /> {viewers.toLocaleString()}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-extrabold text-white">
              {name}
            </h1>
            <p className="mt-1 text-sm text-white/70">{meta}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={ticker}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="mt-3 truncate text-xs text-gold"
              >
                {giftTickerLines[ticker]}
              </motion.p>
            </AnimatePresence>
            {blurOn && (
              <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-cyan">
                <Sparkles className="h-3.5 w-3.5" />
                Blind match · 50% off · blur reveals every 10s
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 pb-1">
            <div className="relative">
              <Image
                src={image}
                alt=""
                width={52}
                height={52}
                className="h-[52px] w-[52px] rounded-full object-cover ring-2 ring-cyan"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-ink bg-teal" />
            </div>

            <button
              type="button"
              onClick={callNow}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-coral shadow-[0_0_28px_var(--glow)]">
                <Phone className="h-6 w-6 text-white" />
              </span>
              <span className="text-[10px] font-bold text-white">
                {rate} /min
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGiftOpen(true)}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <Gift className="h-5 w-5 text-gold" />
              </span>
              <span className="text-[10px] font-semibold text-white/80">Gift</span>
            </button>

            <button
              type="button"
              onClick={() => setBlurOn((b) => !b)}
              className={`flex flex-col items-center gap-1 ${blurOn ? "opacity-100" : "opacity-90"}`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur ${
                  blurOn
                    ? "bg-cyan/30 ring-2 ring-cyan"
                    : "bg-white/15"
                }`}
              >
                <Sparkles className="h-5 w-5 text-cyan" />
              </span>
              <span className="text-[10px] font-semibold text-cyan">Blur</span>
            </button>

            <Link
              href="/premium"
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold backdrop-blur">
                ★
              </span>
              <span className="text-[10px] font-semibold text-gold">VIP</span>
            </Link>
          </div>
        </div>
      </div>

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} />
    </div>
  );
}
