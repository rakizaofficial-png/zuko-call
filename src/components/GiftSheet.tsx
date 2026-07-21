"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { gifts, type Gift } from "@/lib/data";
import { useApp } from "@/lib/store";
import { getDeviceUserId } from "@/lib/walletApi";
import { requireApiBase } from "@/config/apiConfig";
import { getRealtimeClient } from "@/lib/realtime/websocket";

function isCinematic(g: Gift) {
  return g.tier === "cinematic" || g.coins >= 250;
}

export function GiftSheet({
  open,
  onClose,
  onSent,
  hostId,
  roomId,
  callId,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: (emoji: string) => void;
  hostId?: string;
  roomId?: string;
  callId?: string;
}) {
  const { spend, syncWallet, pushToast, displayName, userId } = useApp();
  const [sending, setSending] = useState<string | null>(null);
  const [cinematic, setCinematic] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);

  const basic = gifts.filter((g) => !isCinematic(g));
  const adult = gifts.filter((g) => isCinematic(g));

  const send = async (g: Gift) => {
    if (busy) return;
    const me = getDeviceUserId() || userId;
    if (hostId && me && me === hostId) {
      pushToast?.("Hosts cannot gift themselves!");
      return;
    }
    setBusy(true);
    try {
      if (hostId) {
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
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gift failed");
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

      onSent?.(g.emoji);
      if (isCinematic(g)) {
        setCinematic(g);
        setTimeout(() => {
          setCinematic(null);
          onClose();
          setBusy(false);
        }, 2800);
      } else {
        setSending(g.emoji);
        setTimeout(() => {
          setSending(null);
          onClose();
          setBusy(false);
        }, 700);
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
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 rounded-t-3xl border border-line bg-ink-2 px-4 pb-8 pt-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Send a gift</h3>
                <p className="text-xs text-muted">
                  {hostId
                    ? "Goes to the host · coins deducted"
                    : "Make the moment unforgettable"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-ink-3 p-2 text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              Classic
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {basic.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(g)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-ink-3 px-2 py-3 transition active:scale-95 disabled:opacity-50"
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-xs font-semibold">{g.name}</span>
                  <span className="text-[10px] text-gold">{g.coins} coins</span>
                </button>
              ))}
            </div>

            <p className="mb-2 mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-coral">
              <Sparkles className="h-3 w-3" /> Adult · cinematic (250+)
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {adult.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(g)}
                  className="relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border border-coral/40 bg-gradient-to-b from-coral/20 to-ink-3 px-2 py-3 transition active:scale-95 disabled:opacity-50"
                >
                  <span className="absolute right-1 top-1 rounded-full bg-coral px-1 text-[8px] font-bold text-white">
                    BIG
                  </span>
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-center text-[11px] font-semibold leading-tight">
                    {g.name}
                  </span>
                  <span className="text-[10px] font-bold text-gold">
                    {g.coins} coins
                  </span>
                </button>
              ))}
            </div>

            {sending && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="gift-float text-5xl">{sending}</span>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {cinematic && (
              <motion.div
                className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex flex-col items-center gap-3"
                  initial={{ scale: 0.4, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                >
                  <motion.span
                    className="text-8xl drop-shadow-[0_0_40px_rgba(255,80,120,0.8)]"
                    animate={{
                      scale: [1, 1.15, 1],
                      rotate: [0, -6, 6, 0],
                    }}
                    transition={{ duration: 1.6, repeat: 1 }}
                  >
                    {cinematic.emoji}
                  </motion.span>
                  <p className="font-display text-2xl font-extrabold text-white">
                    {cinematic.name}
                  </p>
                  <p className="rounded-full border border-gold/50 bg-gold/20 px-3 py-1 text-xs font-bold text-gold">
                    Cinematic gift · {cinematic.coins} coins
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
