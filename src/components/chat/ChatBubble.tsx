"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { VipBadge, VipChatBubble } from "@/components/VipChatBubble";
import type { VipTier } from "@/lib/ledger";
import { formatChatTime } from "@/components/chat/formatTime";
import type { ChatMessage } from "@/components/chat/types";

/**
 * Unified bubble — identical in User App and Host App (host uses tier="none").
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

  const outboundSupport =
    variant === "support" && fromMe ? (
      <p className="rounded-2xl rounded-br-sm bg-[#ff9f1a] px-3.5 py-2.5 text-sm text-black">
        {message.text}
      </p>
    ) : null;

  const inboundSupport =
    variant === "support" && !fromMe ? (
      <p className="rounded-2xl rounded-bl-sm border border-cyan/25 bg-ink-2 px-3.5 py-2.5 text-sm text-sand">
        {message.text}
      </p>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[85%]">
        {message.senderLabel && !fromMe ? (
          <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan">
            {message.senderLabel}
          </p>
        ) : null}
        {message.imageUrl ? (
          <button
            type="button"
            onClick={() => onImageClick?.(message.imageUrl!)}
            className="mb-1 block w-full overflow-hidden rounded-2xl ring-1 ring-white/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Shared"
              className="max-h-52 w-full object-cover"
            />
          </button>
        ) : null}
        {outboundSupport}
        {inboundSupport}
        {!outboundSupport && !inboundSupport && fromMe ? (
          <VipChatBubble tier={vipTier} fromMe>
            {message.text}
          </VipChatBubble>
        ) : null}
        {!outboundSupport && !inboundSupport && !fromMe ? (
          <p className="rounded-2xl rounded-bl-md border border-cyan/20 bg-ink-3 px-3.5 py-2.5 text-sm text-sand">
            {message.text}
          </p>
        ) : null}
        <div
          className={`mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40 ${
            fromMe ? "justify-end" : "justify-start"
          }`}
        >
          {showTimestamp ? <span>{formatChatTime(message.at)}</span> : null}
          {fromMe && showReadReceipt ? (
            <span>{message.read === false ? "Sent" : "Read"}</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

/** Host-app outbound bubble (no VIP styling). */
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
