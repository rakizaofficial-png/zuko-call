"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Shared Material-style auth chrome for Android phone screens */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="safe-header relative min-h-dvh overflow-x-hidden px-4 pb-10">
      <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-coral/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-24 h-48 w-48 rounded-full bg-cyan/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative mx-auto w-full max-w-[400px]"
      >
        <Link href="/" className="inline-block">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.32em] text-coral">
            Zuko
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
        </Link>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>

        <div className="mt-7 space-y-3 rounded-[1.5rem] border border-line bg-ink-2/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {children}
        </div>

        {footer ? <div className="mt-5 text-center text-sm">{footer}</div> : null}
      </motion.div>
    </main>
  );
}

export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-2xl border border-line bg-ink px-3.5 py-3 text-sm outline-none ring-coral/0 transition focus:border-coral/50 focus:ring-2 focus:ring-coral/30"
      />
    </label>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  disabled,
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-coral to-[#ff5a9a] text-sm font-bold text-white shadow-[0_10px_28px_rgba(255,42,122,0.35)] transition active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
