"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Search } from "lucide-react";
import {
  fetchUserCallHistory,
  formatCallDuration,
  type CallHistoryRow,
} from "@/lib/callHistoryApi";
import { useApp } from "@/lib/store";

const PAGE_SIZE = 12;

type Filter = "all" | "outgoing" | "incoming" | "missed";

function matchesFilter(c: CallHistoryRow, filter: Filter) {
  const status = (c.status || c.endReason || "").toLowerCase();
  if (filter === "missed") {
    return (
      status.includes("miss") ||
      status.includes("reject") ||
      status.includes("cancel") ||
      (c.durationSec <= 0 && c.coinsSpent === 0)
    );
  }
  if (filter === "incoming") {
    return status.includes("in") || status.includes("incoming");
  }
  if (filter === "outgoing") {
    return !status.includes("incoming");
  }
  return true;
}

export default function CallHistoryPage() {
  const { userId, ready, coins } = useApp();
  const [rows, setRows] = useState<CallHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!ready || !userId) return;
    setLoading(true);
    void fetchUserCallHistory(80)
      .then((data) => setRows(data.calls || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [ready, userId, coins]);

  useEffect(() => {
    setPage(0);
  }, [filter, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (q && !(c.hostName || "").toLowerCase().includes(q)) return false;
      return matchesFilter(c, filter);
    });
  }, [rows, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const slice = filtered.slice(
    pageSafe * PAGE_SIZE,
    pageSafe * PAGE_SIZE + PAGE_SIZE,
  );
  const totalSpent = filtered.reduce((n, c) => n + (c.coinsSpent || 0), 0);

  return (
    <main className="min-h-dvh pb-10">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 border-b border-line/60 bg-ink/90 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-coral">
            History
          </p>
          <h1 className="font-display text-xl font-bold">Call history</h1>
        </div>
        <Phone className="h-5 w-5 text-coral" />
      </header>

      <section className="grid grid-cols-2 gap-2.5 px-4 pt-4">
        <div className="rounded-2xl border border-line bg-ink-2/60 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Calls
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
            {filtered.length}
          </p>
        </div>
        <div className="rounded-2xl border border-coral/25 bg-coral/10 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-coral/80">
            Coins spent
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-coral">
            {totalSpent.toLocaleString()}
          </p>
        </div>
      </section>

      <div className="mt-4 px-4">
        <div className="mb-2 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "All"],
              ["outgoing", "Outgoing"],
              ["incoming", "Incoming"],
              ["missed", "Missed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${
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
            placeholder="Search host…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <ul className="mt-4 space-y-2 px-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : null}
        {!loading &&
          slice.map((c) => {
            const when = new Date(c.startedAt || c.endedAt);
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-line bg-ink-2/55 px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold">
                      {c.hostName || "Host"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {when.toLocaleDateString()} · {when.toLocaleTimeString()}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatCallDuration(c.durationSec)} ·{" "}
                      <span className="capitalize">
                        {(c.status || c.endReason || "ended").replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-sm font-extrabold text-coral">
                    −{c.coinsSpent}
                  </p>
                </div>
              </li>
            );
          })}
        {!loading && !filtered.length ? (
          <p className="py-12 text-center text-sm text-muted">No calls yet</p>
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
