"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Video } from "lucide-react";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";

export type LiveCallRequestPhase =
  | "idle"
  | "ringing"
  | "connecting"
  | "rejected"
  | "missed"
  | "cancelled"
  | "offline";

/**
 * Premium waiting / outcome overlay while host responds to a Live private call.
 */
export function LiveCallRequestOverlay({
  phase,
  hostName,
  hostAvatar,
  hostId,
  statusLine,
  onCancel,
  onDismiss,
}: {
  phase: LiveCallRequestPhase;
  hostName: string;
  hostAvatar?: string;
  hostId: string;
  statusLine?: string;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const visible = phase !== "idle";
  const waiting = phase === "ringing";
  const connecting = phase === "connecting";
  const failed =
    phase === "rejected" ||
    phase === "missed" ||
    phase === "cancelled" ||
    phase === "offline";

  const title =
    phase === "connecting"
      ? "Connecting…"
      : phase === "ringing"
        ? "Waiting for Host…"
        : phase === "rejected"
          ? "Host declined"
          : phase === "missed"
            ? "No answer"
            : phase === "offline"
              ? "Host unavailable"
              : phase === "cancelled"
                ? "Call cancelled"
                : "";

  const subtitle =
    statusLine ||
    (phase === "ringing"
      ? `${hostName} is live — waiting for accept`
      : phase === "connecting"
        ? "Starting private Agora video…"
        : phase === "rejected"
          ? "Reserved coins were refunded"
          : phase === "missed"
            ? "Host didn’t answer · coins refunded"
            : phase === "offline"
              ? "Try again when the host is free"
              : "You cancelled the request");

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/80 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative">
            {waiting || connecting ? (
              <>
                <motion.span
                  className="absolute -inset-6 rounded-full border-2 border-coral/50"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.15, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                <motion.span
                  className="absolute -inset-12 rounded-full border border-cyan/35"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.05, 0.5] }}
                  transition={{ duration: 2.1, repeat: Infinity, delay: 0.2 }}
                />
              </>
            ) : null}
            <motion.div
              className="relative h-28 w-28 overflow-hidden rounded-full border-[3px] border-white/90 shadow-[0_0_40px_rgba(255,42,122,0.45)]"
              animate={
                waiting || connecting
                  ? { scale: [1, 1.04, 1] }
                  : failed
                    ? { scale: [1, 0.96, 1] }
                    : {}
              }
              transition={{
                duration: 1.2,
                repeat: waiting || connecting ? Infinity : 0,
              }}
            >
              <HostAvatarImg
                src={hostAvatar}
                hostId={hostId}
                name={hostName}
                alt=""
                fill
                className="object-cover"
              />
            </motion.div>
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-coral text-white shadow-lg">
              <Video className="h-4 w-4" />
            </span>
          </div>

          <motion.h2
            key={title}
            className="mt-8 font-display text-2xl font-extrabold text-white"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {title}
          </motion.h2>
          <p className="mt-2 max-w-xs text-center text-sm text-white/70">
            {subtitle}
          </p>

          {waiting || connecting ? (
            <div className="mt-8 flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-coral"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          ) : null}

          {waiting ? (
            <button
              type="button"
              onClick={onCancel}
              className="mt-10 flex flex-col items-center gap-2"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40 active:scale-95">
                <PhoneOff className="h-7 w-7" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                Cancel request
              </span>
            </button>
          ) : connecting ? (
            <p className="mt-10 text-[11px] font-bold uppercase tracking-wider text-cyan-200/80">
              Please wait — joining private call
            </p>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-10 min-h-12 rounded-full bg-white px-8 text-sm font-bold text-ink"
            >
              Back to Live
            </button>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
