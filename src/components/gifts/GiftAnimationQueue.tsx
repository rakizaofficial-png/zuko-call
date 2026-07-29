"use client";

import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type LottieData = Record<string, unknown>;

export type GiftAnimation = {
  id?: string;
  giftId: string;
  name: string;
  emoji?: string;
  coins?: number;
  source?: string | LottieData;
  soundUrl?: string;
};

type GiftAnimationContextValue = {
  enqueueGiftAnimation: (gift: GiftAnimation) => void;
};

const GiftAnimationContext = createContext<GiftAnimationContextValue | null>(
  null,
);

const FALLBACK_GIFT_ANIMATION: LottieData = {
  v: "5.12.2",
  fr: 60,
  ip: 0,
  op: 120,
  w: 430,
  h: 720,
  nm: "Gift burst",
  ddd: 0,
  assets: [],
  layers: Array.from({ length: 18 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 18;
    const distance = 115 + (index % 3) * 45;
    const startX = 215;
    const startY = 390;
    return {
      ddd: 0,
      ind: index + 1,
      ty: 4,
      nm: `Coin ${index + 1}`,
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 12, s: [100] },
            { t: 88, s: [100] },
            { t: 116, s: [0] },
          ],
        },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 120, s: [540] }] },
        p: {
          a: 1,
          k: [
            { t: 0, s: [startX, startY, 0] },
            {
              t: 78,
              s: [
                startX + Math.cos(angle) * distance,
                startY + Math.sin(angle) * distance,
                0,
              ],
            },
            {
              t: 120,
              s: [
                startX + Math.cos(angle) * distance * 1.25,
                startY + Math.sin(angle) * distance * 1.25 + 90,
                0,
              ],
            },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [15, 15, 100] },
            { t: 18, s: [115, 115, 100] },
            { t: 120, s: [45, 45, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [28, 28] },
          nm: "Coin",
        },
        {
          ty: "fl",
          c: {
            a: 0,
            k:
              index % 2
                ? [1, 0.36, 0.45, 1]
                : [1, 0.78, 0.18, 1],
          },
          o: { a: 0, k: 100 },
          r: 1,
          nm: "Fill",
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    };
  }),
  markers: [],
};

function queueKey(gift: GiftAnimation) {
  return gift.id || `${gift.giftId}:${Date.now()}:${Math.random()}`;
}

export function GiftAnimationQueueProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [queue, setQueue] = useState<Array<GiftAnimation & { id: string }>>([]);
  const [remoteAnimation, setRemoteAnimation] = useState<{
    url: string;
    data: LottieData;
  } | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const soundRef = useRef<HTMLAudioElement | null>(null);
  const finishingRef = useRef<string | null>(null);
  const active = queue[0] ?? null;
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = active?.id || null;
  }, [active?.id]);
  const animationData =
    typeof active?.source === "string"
      ? remoteAnimation?.url === active.source
        ? remoteAnimation.data
        : null
      : active?.source && typeof active.source === "object"
        ? active.source
        : active
          ? FALLBACK_GIFT_ANIMATION
          : null;

  const enqueueGiftAnimation = useCallback((gift: GiftAnimation) => {
    const item = { ...gift, id: queueKey(gift) };
    setQueue((current) => {
      if (current.some((queued) => queued.id === item.id)) return current;
      return [...current.slice(-19), item];
    });
  }, []);

  const dismiss = useCallback(() => {
    const activeId = activeIdRef.current;
    if (!activeId || finishingRef.current === activeId) return;
    finishingRef.current = activeId;
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.currentTime = 0;
      soundRef.current.src = "";
      soundRef.current = null;
    }
    setQueue((current) => {
      const next = current[0]?.id === activeId ? current.slice(1) : current;
      queueMicrotask(() => {
        if (finishingRef.current === activeId) finishingRef.current = null;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sourceUrl =
      typeof active?.source === "string" ? active.source : null;
    if (!sourceUrl) return;
    void fetch(sourceUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Gift animation download failed");
        return response.json() as Promise<LottieData>;
      })
      .then((data) => {
        if (!cancelled) setRemoteAnimation({ url: sourceUrl, data });
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteAnimation({
            url: sourceUrl,
            data: FALLBACK_GIFT_ANIMATION,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const safetyTimer = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(safetyTimer);
  }, [active, dismiss]);

  useEffect(() => {
    if (!active || !animationData || !active.soundUrl) return;
    const sound = new Audio(active.soundUrl);
    sound.preload = "auto";
    sound.volume = 0.78;
    soundRef.current = sound;
    void sound.play().catch(() => {
      // Mobile browsers can reject autoplay; the gift send tap normally unlocks it.
    });
    return () => {
      sound.pause();
      sound.currentTime = 0;
      sound.src = "";
      if (soundRef.current === sound) soundRef.current = null;
    };
  }, [active, animationData]);

  const value = useMemo(
    () => ({ enqueueGiftAnimation }),
    [enqueueGiftAnimation],
  );

  return (
    <GiftAnimationContext.Provider value={value}>
      {children}
      <AnimatePresence mode="wait">
        {active && animationData ? (
          <motion.div
            key={active.id}
            className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Lottie
              lottieRef={lottieRef}
              animationData={animationData}
              autoplay
              loop={false}
              onComplete={dismiss}
              className="absolute inset-0 h-full w-full"
              rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
            />
            <motion.div
              className="relative flex flex-col items-center"
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{ scale: [0.35, 1.25, 1], opacity: 1 }}
              transition={{ duration: 0.55 }}
            >
              <span className="text-8xl drop-shadow-[0_0_35px_rgba(255,190,40,0.9)]">
                {active.emoji || "🎁"}
              </span>
              <p className="mt-3 rounded-full border border-white/25 bg-black/55 px-4 py-1.5 text-sm font-extrabold text-white backdrop-blur-lg">
                {active.name}
                {active.coins ? ` · ${active.coins} coins` : ""}
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </GiftAnimationContext.Provider>
  );
}

export function useGiftAnimationQueue() {
  const context = useContext(GiftAnimationContext);
  if (!context) {
    throw new Error(
      "useGiftAnimationQueue must be used inside GiftAnimationQueueProvider",
    );
  }
  return context;
}
