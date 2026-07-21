"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SPIN_PRIZES, canSpin, spinCoinsRemaining } from "@/lib/engagement";
import { spinsRemaining, useApp } from "@/lib/store";

export function LuckySpinModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { doLuckySpin, engagement } = useApp();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const left = spinsRemaining(engagement);
  const capLeft = spinCoinsRemaining(engagement);
  const allowed = canSpin(engagement);

  const segments = useMemo(() => SPIN_PRIZES, []);

  if (!open) return null;

  const spin = async () => {
    if (spinning || !allowed) return;
    setSpinning(true);
    setResultLabel(null);
    const result = await doLuckySpin();
    const idx = Math.max(
      0,
      segments.findIndex((s) => s.id === result.prize?.id),
    );
    const slice = 360 / segments.length;
    const target =
      360 * 6 + (360 - idx * slice - slice / 2) + Math.random() * 8;
    setRotation((r) => r + target);
    setTimeout(() => {
      setResultLabel(result.message);
      setSpinning(false);
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[400px] rounded-3xl border border-line bg-ink-2 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-extrabold">Lucky Spin</p>
            <p className="text-xs text-muted">
              {left} spin left today · {capLeft} coins cap left
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-ink-3 p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mx-auto mb-5 h-56 w-56">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-coral">
            ▼
          </div>
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 3, ease: [0.15, 0.8, 0.1, 1] }}
            className="h-full w-full overflow-hidden rounded-full border-4 border-gold/40 shadow-[0_0_40px_rgba(255,184,0,0.25)]"
            style={{
              background: `conic-gradient(${segments
                .map((s, i) => {
                  const start = (i / segments.length) * 100;
                  const end = ((i + 1) / segments.length) * 100;
                  return `${s.color} ${start}% ${end}%`;
                })
                .join(", ")})`,
            }}
          >
            {segments.map((s, i) => {
              const angle = (i + 0.5) * (360 / segments.length);
              return (
                <span
                  key={s.id}
                  className="absolute left-1/2 top-1/2 origin-center text-[10px] font-extrabold text-white"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-78px) rotate(${-angle}deg)`,
                  }}
                >
                  {s.label}
                </span>
              );
            })}
          </motion.div>
        </div>

        {resultLabel ? (
          <p className="mb-3 text-center text-sm font-bold text-gold">
            {resultLabel}
          </p>
        ) : null}

        <button
          type="button"
          disabled={spinning || !allowed}
          onClick={() => void spin()}
          className="w-full rounded-full bg-gradient-to-r from-coral to-coral-2 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {spinning
            ? "Spinning…"
            : allowed
              ? "Spin now"
              : left <= 0
                ? "Come back tomorrow"
                : "Spin limit reached"}
        </button>
      </motion.div>
    </div>
  );
}
