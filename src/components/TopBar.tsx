"use client";

import Link from "next/link";
import { Coins, Crown } from "lucide-react";
import { useApp } from "@/lib/store";

export function TopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { coins, isPremium } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-ink/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="min-w-0">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-coral">
          Luma
        </p>
        <h1 className="font-display truncate text-xl font-bold leading-tight text-sand">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-muted">{subtitle}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isPremium && (
          <Link
            href="/premium"
            className="flex h-9 items-center gap-1 rounded-full bg-gold/15 px-2.5 text-gold"
          >
            <Crown className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">VIP</span>
          </Link>
        )}
        <Link
          href="/wallet"
          className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-ink-3 px-3 shadow-[0_0_20px_var(--glow)]"
        >
          <Coins className="h-4 w-4 text-gold" />
          <span className="text-sm font-bold tabular-nums text-sand">
            {coins.toLocaleString()}
          </span>
        </Link>
      </div>
    </header>
  );
}
