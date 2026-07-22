"use client";

import type { ReactNode } from "react";
import { Send } from "lucide-react";

const DEFAULT_EMOJIS = ["😀", "😍", "🔥", "💕", "😘", "✨", "🎉", "👋", "🥰", "😎"];

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending = false,
  placeholder = "Write a message…",
  disabled = false,
  emojiOpen = false,
  onToggleEmoji,
  emojis = DEFAULT_EMOJIS,
  onEmojiPick,
  leading,
  trailing,
  footerNote,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emojiOpen?: boolean;
  onToggleEmoji?: () => void;
  emojis?: string[];
  onEmojiPick?: (emoji: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  footerNote?: ReactNode;
}) {
  const canSend = !sending && !disabled && value.trim().length > 0;

  return (
    <>
      {emojiOpen && onEmojiPick ? (
        <div className="mb-2 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-[#06040b] p-2">
          {emojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onEmojiPick(e)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg active:scale-95"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {leading}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          disabled={sending || disabled}
          enterKeyHint="send"
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#06040b] px-4 py-2.5 text-sm text-sand outline-none placeholder:text-white/35 disabled:opacity-60"
        />
        {trailing ?? (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="rounded-full bg-[#ff9f1a] p-2.5 text-black disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
      {footerNote ? (
        <div className="mt-1.5 text-center text-[10px] text-white/35">
          {footerNote}
        </div>
      ) : null}
    </>
  );
}
