"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { VipBadge } from "@/components/VipChatBubble";
import type { VipTier } from "@/lib/ledger";
import { formatChatTime } from "@/components/chat/formatTime";
import type { ChatMessage } from "@/components/chat/types";

/**
 * Modern messaging bubble — WhatsApp-inspired layout.
 * Preserves VIP badge for outbound DM; no backend changes.
 */
export function ChatBubble({
  message,
  vipTier = "none",
  variant = "dm",
  showTimestamp = true,
  showReadReceipt = true,
  onImageClick,
}: {
  message: ChatMessage;
  vipTier?: VipTier;
  variant?: "dm" | "support";
  showTimestamp?: boolean;
  showReadReceipt?: boolean;
  onImageClick?: (url: string) => void;
}) {
  const fromMe = message.from === "me";

  const bubbleClass = fromMe
    ? variant === "support"
      ? "rounded-2xl rounded-br-md bg-[#ff9f1a] text-black"
      : "rounded-2xl rounded-br-md bg-[#005c4b] text-white"
    : variant === "support"
      ? "rounded-2xl rounded-bl-md border border-cyan/20 bg-[#1f2c34] text-sand"
      : "rounded-2xl rounded-bl-md bg-[#1f2c34] text-sand";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[82%] ${fromMe ? "items-end" : "items-start"}`}>
        {message.senderLabel && !fromMe ? (
          <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-cyan">
            {message.senderLabel}
          </p>
        ) : null}
        {fromMe && vipTier !== "none" ? (
          <div className="mb-1 flex justify-end">
            <VipBadge tier={vipTier} />
          </div>
        ) : null}
        <div className={`relative px-3 py-2 shadow-sm ${bubbleClass}`}>
          {message.imageUrl ? (
            <button
              type="button"
              onClick={() => onImageClick?.(message.imageUrl!)}
              className="mb-1.5 block w-full overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt="Shared"
                className="max-h-52 w-full object-cover"
              />
            </button>
          ) : null}
          {message.text ? (
            <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.35]">
              {message.text}
            </p>
          ) : null}
          <div
            className={`mt-1 flex items-center gap-1.5 ${
              fromMe ? "justify-end" : "justify-start"
            }`}
          >
            {showTimestamp ? (
              <span
                className={`text-[10px] tabular-nums ${
                  fromMe && variant !== "support"
                    ? "text-white/55"
                    : "text-white/40"
                }`}
              >
                {formatChatTime(message.at)}
              </span>
            ) : null}
            {fromMe && showReadReceipt ? (
              <span
                className={`text-[10px] font-semibold ${
                  message.read === false
                    ? "text-white/45"
                    : "text-[#53bdeb]"
                }`}
              >
                {message.read === false ? "✓" : "✓✓"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function HostChatBubble({
  children,
  at,
  read,
}: {
  children: ReactNode;
  at?: number;
  read?: boolean;
}) {
  return (
    <ChatBubble
      message={{
        id: "host-out",
        from: "me",
        text: String(children),
        at: at ?? Date.now(),
        read,
      }}
      vipTier="none"
    />
  );
}

export { VipBadge };
