"use client";

import type { LiveComment } from "@/lib/liveApi";

const BUBBLE_STYLES = [
  "border-sky-400/55 bg-sky-500/25",
  "border-pink-400/55 bg-pink-500/25",
  "border-amber-400/55 bg-amber-500/25",
  "border-violet-400/55 bg-violet-500/25",
  "border-emerald-400/55 bg-emerald-500/25",
  "border-rose-400/55 bg-rose-500/25",
];

const BADGE_STYLES = [
  "bg-sky-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % 997;
  return h;
}

function levelFor(name: string) {
  return String((hashName(name) % 28) + 1).padStart(2, "0");
}

/**
 * Modern live chat line — level badge + username + message (reference style).
 */
export function LiveChatBubble({ m }: { m: LiveComment }) {
  const idx = hashName(m.userName || "?") % BUBBLE_STYLES.length;
  const bubble = BUBBLE_STYLES[idx]!;
  const badge = BADGE_STYLES[idx]!;
  const level = levelFor(m.userName || "Fan");

  if (m.kind === "gift") {
    return (
      <div
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] text-white shadow-md backdrop-blur-md ${bubble}`}
      >
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white ${badge}`}
        >
          {level}
        </span>
        <span className="font-bold">{m.userName}</span>
        <span className="opacity-95">
          Send {m.giftEmoji || "🎁"} {m.text.replace(/^sent\s+/i, "") || "gift"}
        </span>
      </div>
    );
  }

  if (m.kind === "join") {
    return (
      <div
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] text-white/95 shadow-md backdrop-blur-md ${bubble}`}
      >
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white ${badge}`}
        >
          {level}
        </span>
        <span className="font-bold">{m.userName}</span>
        <span className="opacity-85">joined</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] leading-snug text-white shadow-md backdrop-blur-md ${bubble}`}
    >
      <span
        className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white ${badge}`}
      >
        {level}
      </span>
      <span className="shrink-0 font-bold">{m.userName}:</span>
      <span className="min-w-0 break-words opacity-95">{m.text}</span>
    </div>
  );
}
