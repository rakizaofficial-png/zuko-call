"use client";

import { useEffect, type ReactNode } from "react";
import {
  useChatKeyboard,
  useElementHeight,
} from "@/hooks/useChatKeyboard";

/**
 * Fixed chat shell — header + composer never move; only the message list scrolls.
 * Keyboard inset lifts the composer without shifting the whole page.
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
  /** Change when messages update to auto-scroll the list */
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
      className={`chat-shell fixed inset-0 z-50 mx-auto w-full max-w-[430px] overflow-hidden bg-[#06040b] ${className}`}
      data-chat-shell="1"
    >
      <header
        ref={headerRef}
        className="chat-shell-header safe-header fixed left-0 right-0 top-0 z-30 mx-auto w-full max-w-[430px] border-b border-white/10 bg-[#06040b]/98 backdrop-blur-xl"
      >
        {header}
      </header>

      <div
        ref={listRef}
        className="chat-shell-list space-y-3 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]"
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
        className="chat-shell-footer safe-footer fixed left-0 right-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/10 bg-ink-2/98 px-3 py-3 backdrop-blur-xl"
        style={{
          bottom: "var(--kb-inset, 0px)",
          transition: "bottom 0.2s ease-out",
        }}
      >
        {footer}
      </div>
    </div>
  );
}
