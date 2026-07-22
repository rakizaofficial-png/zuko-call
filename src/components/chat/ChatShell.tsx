"use client";

import { useEffect, type ReactNode } from "react";
import {
  useChatKeyboard,
  useElementHeight,
} from "@/hooks/useChatKeyboard";

/**
 * Fixed chat shell — WhatsApp-style layout.
 * Header + composer stay pinned; only the message list scrolls.
 */
export function ChatShell({
  header,
  footer,
  children,
  scrollKey,
  className = "",
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  scrollKey?: string | number;
  className?: string;
}) {
  useChatKeyboard(true);
  const { ref: headerRef, height: headerH } = useElementHeight<HTMLElement>();
  const { ref: footerRef, height: footerH } = useElementHeight<HTMLDivElement>();
  const { ref: listRef } = useElementHeight<HTMLDivElement>();

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollKey, footerH, listRef]);

  return (
    <div
      className={`chat-shell fixed inset-0 z-50 mx-auto w-full max-w-[430px] overflow-hidden bg-[#0b141a] ${className}`}
      data-chat-shell="1"
    >
      {/* Subtle chat wallpaper */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #ff2a7a 0, transparent 40%), radial-gradient(circle at 80% 60%, #00f0ff 0, transparent 35%)",
        }}
      />

      <header
        ref={headerRef}
        className="chat-shell-header safe-header fixed left-0 right-0 top-0 z-30 mx-auto w-full max-w-[430px] border-b border-white/8 bg-[#111b21]/96 backdrop-blur-xl"
      >
        {header}
      </header>

      <div
        ref={listRef}
        className="chat-shell-list space-y-1.5 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          marginLeft: "auto",
          marginRight: "auto",
          maxWidth: "430px",
          top: headerH,
          bottom: `calc(${footerH}px + var(--kb-inset, 0px))`,
        }}
      >
        {children}
      </div>

      <div
        ref={footerRef}
        className="chat-shell-footer safe-footer fixed left-0 right-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/8 bg-[#111b21]/98 px-2.5 py-2.5 backdrop-blur-xl"
        style={{
          bottom: "var(--kb-inset, 0px)",
          transition: "bottom 0.18s ease-out",
        }}
      >
        {footer}
      </div>
    </div>
  );
}
