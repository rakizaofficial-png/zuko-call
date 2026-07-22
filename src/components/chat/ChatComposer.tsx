"use client";

import type { ReactNode } from "react";
import { Send, Smile } from "lucide-react";

const DEFAULT_EMOJIS = ["😀", "😍", "🔥", "💕", "😘", "✨", "🎉", "👋", "🥰", "😎"];

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending = false,
  placeholder = "Message",
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
    <div className="space-y-2">
      {emojiOpen && onEmojiPick ? (
        <div className="flex flex-wrap gap-1 rounded-2xl border border-white/8 bg-[#0b141a] p-2">
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

      <div className="flex items-end gap-1.5">
        {leading}
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[24px] border border-white/10 bg-[#2a3942] px-2 py-1">
          {onToggleEmoji ? (
            <button
              type="button"
              onClick={onToggleEmoji}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55"
              aria-label="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
          ) : null}
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
            className="min-h-10 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-sand outline-none placeholder:text-white/35 disabled:opacity-60"
          />
        </div>
        {trailing ?? (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {footerNote ? (
        <div className="text-center text-[10px] text-white/30">{footerNote}</div>
      ) : null}
    </div>
  );
}
