"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Locks the document while a chat screen is open and tracks keyboard height via
 * visualViewport so only the composer/list adjust — the page never scrolls up.
 */
export function useChatKeyboard(active = true) {
  const [kbInset, setKbInset] = useState(0);
  const scrollLockY = useRef(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const root = document.documentElement;
    const body = document.body;
    scrollLockY.current = window.scrollY;

    root.classList.add("chat-keyboard-open");
    body.classList.add("chat-keyboard-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollLockY.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const vv = window.visualViewport;
    const sync = () => {
      if (!vv) {
        setKbInset(0);
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset);
      root.style.setProperty("--kb-inset", `${inset}px`);
      // Keep layout viewport pinned — prevents whole-page jump on Android WebView
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      root.classList.remove("chat-keyboard-open");
      body.classList.remove("chat-keyboard-open");
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      root.style.removeProperty("--kb-inset");
      window.scrollTo(0, scrollLockY.current);
    };
  }, [active]);

  return kbInset;
}

/** Measure a fixed chrome region (header or composer). */
export function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, height };
}
