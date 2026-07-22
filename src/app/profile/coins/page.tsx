"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Search } from "lucide-react";
import {
  fetchWalletHistory,
  type WalletLedgerEntry,
} from "@/lib/walletApi";
import { useApp } from "@/lib/store";

const PAGE_SIZE = 14;

type Filter = "all" | "credit" | "spend";

export default function CoinHistoryPage() {
  const { coins, engagement } = useApp();
  const [rows, setRows] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    void fetchWalletHistory()
      .then((h) => setRows(h.length ? h : engagement.coinHistory))
      .catch(() => setRows(engagement.coinHistory))
      .finally(() => setLoading(false));
  }, [coins, engagement.coinHistory]);

  useEffect(() => {
    setPage(0);
  }, [filter, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      if (q && !(e.reason || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const slice = filtered.slice(
    pageSafe * PAGE_SIZE,
    pageSafe * PAGE_SIZE + PAGE_SIZE,
  );

  const credited = filtered
    .filter((e) => e.kind === "credit")
    .reduce((n, e) => n + e.amount, 0);
  const spent = filtered
    .filter((e) => e.kind === "spend")
    .reduce((n, e) => n + e.amount, 0);

  return (
    <main className="min-h-dvh pb-10">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 border-b border-line/60 bg-ink/90 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Wallet
          </p>
          <h1 className="font-display text-xl font-bold">Coin history</h1>
        </div>
        <Coins className="h-5 w-5 text-gold" />
      </header>

      <section className="grid grid-cols-3 gap-2 px-4 pt-4">
        <div className="rounded-2xl border border-line bg-ink-2/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Balance
          </p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums">
            {coins.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-teal/25 bg-teal/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal/80">
            In
          </p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-teal">
            +{credited.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-coral/25 bg-coral/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-coral/80">
            Out
          </p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-coral">
            −{spent.toLocaleString()}
          </p>
        </div>
      </section>

      <div className="mt-4 px-4">
        <div className="mb-2 flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["credit", "Credits"],
              ["spend", "Spends"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3.5 py-2 text-[11px] font-bold ${
                filter === id
                  ? "bg-coral text-white"
                  : "border border-line bg-ink-2/50 text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-ink-2/60 px-3.5 py-2.5">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reason…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <ul className="mt-4 space-y-2 px-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : null}
        {!loading &&
          slice.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-2/55 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.reason}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {new Date(e.at).toLocaleString()}
                </p>
              </div>
              <p
                className={`shrink-0 font-display text-sm font-extrabold ${
                  e.kind === "credit" ? "text-teal" : "text-coral"
                }`}
              >
                {e.kind === "credit" ? "+" : "−"}
                {e.amount}
              </p>
            </li>
          ))}
        {!loading && !filtered.length ? (
          <p className="py-12 text-center text-sm text-muted">
            No transactions yet
          </p>
        ) : null}
      </ul>

      {filtered.length > PAGE_SIZE ? (
        <div className="mt-5 flex items-center justify-center gap-3 px-4">
          <button
            type="button"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full border border-line px-4 py-2 text-xs font-bold disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-muted">
            {pageSafe + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={pageSafe >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-full border border-line px-4 py-2 text-xs font-bold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </main>
  );
}
