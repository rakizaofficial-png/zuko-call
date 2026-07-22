"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Wallet } from "lucide-react";
import {
  fetchWalletHistory,
  type WalletLedgerEntry,
} from "@/lib/walletApi";
import { listCoinTransactions } from "@/lib/coinLedger";
import { restorePurchases } from "@/lib/payments/iap";
import { useApp } from "@/lib/store";

type Tab = "all" | "recharge" | "spend" | "refund" | "gift";

export default function WalletPage() {
  const { coins, syncWallet, engagement, clientReady, pushToast, openTopUp } =
    useApp();
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const h = await fetchWalletHistory();
      const local = listCoinTransactions(40).map((t) => ({
        id: t.id,
        amount: t.amount,
        reason: `${t.reason} · ${t.status}${t.serverId ? ` · #${t.serverId.slice(0, 8)}` : ""}`,
        kind: (t.type === "recharge" ||
        t.type === "refund" ||
        t.type === "bonus" ||
        t.type === "referral" ||
        t.type === "vip"
          ? "credit"
          : "spend") as "credit" | "spend",
        at: t.at,
      }));
      const merged = [...(h.length ? h : engagement.coinHistory), ...local];
      const seen = new Set<string>();
      setEntries(
        merged.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        }),
      );
    } catch {
      setEntries(engagement.coinHistory);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins, engagement.coinHistory]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const reason = (e.reason || "").toLowerCase();
      if (tab === "recharge") {
        return (
          e.kind === "credit" &&
          /recharge|purchase|iap|top.?up|pack/.test(reason)
        );
      }
      if (tab === "spend") {
        return e.kind === "spend" && !/gift/.test(reason);
      }
      if (tab === "gift") {
        return /gift/.test(reason);
      }
      if (tab === "refund") {
        return /refund/.test(reason);
      }
      return true;
    });
  }, [entries, tab]);

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Wallet
          </p>
          <h1 className="font-display text-xl font-bold">Coins & history</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            void syncWallet();
            void load();
            pushToast("Wallet refreshed");
          }}
          className="rounded-full border border-line bg-ink-2/80 p-2.5"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <section className="px-4 pt-2">
        <div className="rounded-[1.5rem] border border-gold/30 bg-gradient-to-br from-gold/15 via-ink-2 to-ink p-5">
          <Wallet className="h-6 w-6 text-gold" />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Current balance
          </p>
          <p className="font-display text-4xl font-extrabold tabular-nums">
            {(clientReady ? coins : 0).toLocaleString()}
            <span className="ml-2 text-base font-bold text-gold">coins</span>
          </p>
          <p className="mt-2 text-[11px] text-muted">
            Every transaction is logged with a unique ID. Server is the source of
            truth.
          </p>
          <button
            type="button"
            onClick={() => openTopUp(15)}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-gold to-coral text-sm font-bold text-ink"
          >
            Recharge coins
          </button>
          <button
            type="button"
            onClick={() => {
              void restorePurchases().then(async (r) => {
                await syncWallet();
                pushToast(r.message);
              });
            }}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl border border-line bg-ink/50 text-xs font-bold"
          >
            Restore Play purchases
          </button>
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "All"],
              ["recharge", "Recharge"],
              ["spend", "Calls"],
              ["gift", "Gifts"],
              ["refund", "Refunds"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${
                tab === id
                  ? "bg-coral text-white"
                  : "border border-line bg-ink-2/60 text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-3 space-y-2 pb-8">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted">Loading…</p>
          ) : filtered.length ? (
            filtered.slice(0, 50).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-ink-2/50 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.reason}</p>
                  <p className="truncate text-[10px] text-muted">
                    {new Date(e.at).toLocaleString()} · {e.id.slice(0, 18)}
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
            ))
          ) : (
            <p className="py-10 text-center text-xs text-muted">
              No {tab === "all" ? "" : `${tab} `}transactions yet
            </p>
          )}
        </ul>
      </section>
    </main>
  );
}
