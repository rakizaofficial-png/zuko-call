"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Sparkles, X } from "lucide-react";
import { gifts, type Gift } from "@/lib/data";
import { fetchGiftCatalog } from "@/lib/giftCatalog";
import { useApp } from "@/lib/store";
import { getDeviceUserId } from "@/lib/walletApi";
import { requireApiBase } from "@/config/apiConfig";
import { getRealtimeClient } from "@/lib/realtime/websocket";
import { playGiftChime } from "@/lib/liveGiftSound";
import { pushSheetCloser } from "@/lib/sheetBackStack";
import {
  giftTxId,
  hasCompletedTx,
  markTxCompleted,
  markTxFailed,
  recordPendingTx,
} from "@/lib/coinLedger";
import { useGiftAnimationQueue } from "@/components/gifts/GiftAnimationQueue";

function isCinematic(g: Gift) {
  return (
    g.tier === "cinematic" ||
    g.tier === "luxury" ||
    g.tier === "vip" ||
    g.tier === "legendary" ||
    g.coins >= 250
  );
}

function giftTierLabel(g: Gift) {
  if (g.coins >= 2000 || g.tier === "legendary") return "Legendary";
  if (g.coins >= 700 || g.tier === "vip") return "VIP";
  if (g.coins >= 250 || g.tier === "luxury" || g.tier === "cinematic")
    return "Luxury";
  if (g.coins >= 100 || g.tier === "large") return "Large";
  if (g.coins >= 40 || g.tier === "medium" || g.tier === "premium")
    return "Medium";
  return "Small";
}

/**
 * TikTok-style gift coin box — compact bottom sheet (~52dvh), scrollable grid.
 * Never expands to full screen.
 */
export function GiftSheet({
  open,
  onClose,
  onSent,
  hostId,
  roomId,
  callId,
  highlightMinCoins,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: (emoji: string, gift?: Gift) => void;
  hostId?: string;
  roomId?: string;
  callId?: string;
  highlightMinCoins?: number;
}) {
  const { spend, syncWallet, pushToast, displayName, userId, coins, openTopUp } =
    useApp();
  const [sending, setSending] = useState<string | null>(null);
  const { enqueueGiftAnimation } = useGiftAnimationQueue();
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Gift[]>(gifts);
  const [tab, setTab] = useState<"popular" | "vip" | "mega">("popular");

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchGiftCatalog().then((next) => {
      if (active) setCatalog(next);
    });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return pushSheetCloser(onClose);
  }, [open, onClose]);

  const categoryFor = (gift: Gift) =>
    gift.category ||
    (gift.coins >= 1200 ? "mega" : gift.coins >= 250 ? "vip" : "popular");
  const shown = catalog.filter((gift) => categoryFor(gift) === tab);

  const send = async (g: Gift) => {
    if (busy) return;
    const me = getDeviceUserId() || userId;
    if (hostId && me && me === hostId) {
      pushToast?.("Hosts cannot gift themselves!");
      return;
    }
    if (coins < g.coins) {
      pushToast?.("Not enough coins — recharge to send this gift");
      openTopUp?.(g.coins);
      return;
    }
    setBusy(true);
    const txId = giftTxId(g.id, hostId || "none");
    if (hasCompletedTx(txId)) {
      setBusy(false);
      onClose();
      return;
    }
    try {
      if (hostId) {
        recordPendingTx({
          id: txId,
          userId: me,
          hostId,
          giftId: g.id,
          callId,
          amount: g.coins,
          type: "gift",
          reason: `gift_${g.id}`,
        });
        const res = await fetch(`${requireApiBase()}/gifts/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": me,
          },
          body: JSON.stringify({
            userId: me,
            userName: displayName || "Zuko Fan",
            hostId,
            giftId: g.id,
            roomId,
            callId,
            clientTxId: txId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          markTxFailed(txId, data.error || "Gift failed");
          if (res.status === 402) {
            openTopUp?.(g.coins);
          }
          throw new Error(data.error || "Gift failed");
        }
        markTxCompleted(txId, {
          serverId: data.transactionId,
        });
        await syncWallet?.();
        try {
          getRealtimeClient(me).sendGift({
            roomId,
            toHostId: hostId,
            giftId: g.id,
            coins: g.coins,
            label: g.name,
          });
        } catch {
          /* optional WS mirror */
        }
      } else if (!spend(g.coins, `Sent ${g.name} ${g.emoji}`)) {
        setBusy(false);
        return;
      }

      playGiftChime(g.coins);
      onSent?.(g.emoji, g);
      if (isCinematic(g)) {
        enqueueGiftAnimation({
          giftId: g.id,
          name: g.name,
          emoji: g.emoji,
          coins: g.coins,
          source: g.animationUrl,
          soundUrl: g.soundUrl,
        });
        setTimeout(() => {
          onClose();
          setBusy(false);
        }, 350);
      } else {
        setSending(g.emoji);
        setTimeout(() => {
          setSending(null);
          onClose();
          setBusy(false);
        }, 650);
      }
    } catch (e) {
      pushToast?.(e instanceof Error ? e.message : "Could not send gift");
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[80] bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* TikTok coin box — bottom half only */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Gift box"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.85 }}
            className="fixed bottom-0 left-1/2 z-[85] flex w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden rounded-t-[1.65rem] border border-white/12 bg-[#12141c]/98 shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            style={{
              maxHeight: "min(52dvh, 420px)",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" />

            <div className="flex shrink-0 items-center justify-between gap-2 px-3.5 pb-2 pt-2.5">
              <div className="min-w-0">
                <h3 className="font-display text-[15px] font-extrabold tracking-tight text-white">
                  Gift box
                </h3>
                <p className="flex items-center gap-1 text-[11px] text-white/55">
                  <Coins className="h-3 w-3 text-amber-300" />
                  Balance{" "}
                  <span className="font-bold text-amber-200">
                    {coins.toLocaleString()}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openTopUp?.(50)}
                  className="rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-2.5 py-1 text-[10px] font-extrabold text-ink"
                >
                  Recharge
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-white/10 p-1.5 text-white/70"
                  aria-label="Close gift box"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mx-3.5 mb-2 flex shrink-0 rounded-full bg-white/8 p-0.5">
              {(
                [
                  ["popular", "Popular"],
                  ["vip", "VIP"],
                  ["mega", "Mega/Adult"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`relative flex-1 rounded-full py-1.5 text-center text-[11px] font-bold transition ${
                    tab === key ? "text-ink" : "text-white/55"
                  }`}
                >
                  {tab === key ? (
                    <motion.span
                      layoutId="gift-tab-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-400"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}
                  <span className="relative z-[1] inline-flex items-center justify-center gap-1">
                    {key !== "popular" ? <Sparkles className="h-3 w-3" /> : null}
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 [-webkit-overflow-scrolling:touch]">
              <div className="grid grid-cols-4 gap-1.5">
                {shown.map((g, i) => {
                  const unlockOk =
                    highlightMinCoins != null && g.coins >= highlightMinCoins;
                  return (
                    <motion.button
                      key={g.id}
                      type="button"
                      disabled={busy}
                      initial={{ opacity: 0, y: 10, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: Math.min(i, 8) * 0.02, duration: 0.22 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => void send(g)}
                      className={`relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 disabled:opacity-50 ${
                        unlockOk
                          ? "border-amber-300/55 bg-amber-400/15"
                          : tab !== "popular"
                            ? "border-rose-400/35 bg-gradient-to-b from-rose-500/20 to-white/5"
                            : "border-white/10 bg-white/[0.06]"
                      }`}
                    >
                      <span className="absolute left-0.5 top-0.5 rounded bg-black/35 px-1 text-[7px] font-bold uppercase text-white/70">
                        {unlockOk ? "OK" : giftTierLabel(g)}
                      </span>
                      <span className="text-[1.65rem] leading-none drop-shadow">
                        {g.emoji}
                      </span>
                      <span className="line-clamp-1 text-center text-[9px] font-semibold text-white/90">
                        {g.name}
                      </span>
                      <span className="text-[9px] font-bold text-amber-300">
                        {g.coins}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {sending ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <motion.span
                  className="text-5xl"
                  initial={{ scale: 0.4, opacity: 0, y: 24 }}
                  animate={{ scale: 1.15, opacity: 1, y: -12 }}
                  exit={{ opacity: 0 }}
                >
                  {sending}
                </motion.span>
              </div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
