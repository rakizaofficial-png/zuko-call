/**
 * Client-side coin ledger — idempotency, traceability, and rollback tracking.
 * Express API remains authoritative for balances; this layer prevents duplicate
 * client-initiated debits and records every movement with a unique tx id.
 */

const LEDGER_KEY = "zuko_coin_ledger_v1";
const MAX_ENTRIES = 500;

export type CoinTxType =
  | "recharge"
  | "call_minute"
  | "audio_call"
  | "video_call"
  | "gift"
  | "refund"
  | "bonus"
  | "referral"
  | "vip"
  | "match"
  | "withdrawal"
  | "admin_adjust"
  | "spend";

export type CoinTxStatus = "pending" | "completed" | "failed" | "rolled_back";

export type CoinTransaction = {
  id: string;
  serverId?: string;
  userId: string;
  hostId?: string;
  callId?: string;
  giftId?: string;
  amount: number;
  type: CoinTxType;
  status: CoinTxStatus;
  reason: string;
  at: number;
  meta?: Record<string, unknown>;
  error?: string;
};

function readLedger(): CoinTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CoinTransaction[];
  } catch {
    return [];
  }
}

function writeLedger(rows: CoinTransaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify(rows.slice(-MAX_ENTRIES)),
    );
  } catch {
    /* ignore quota */
  }
}

/** Deterministic id for per-minute billing — same minute never bills twice. */
export function callMinuteTxId(callId: string, minuteIndex: number): string {
  return `tx_call_${callId}_m${minuteIndex}`;
}

export function giftTxId(giftId: string, hostId: string): string {
  return `tx_gift_${hostId}_${giftId}_${Date.now().toString(36)}`;
}

export function spendTxId(reason: string): string {
  const slug = reason.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  return `tx_spend_${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function hasCompletedTx(id: string): boolean {
  return readLedger().some((t) => t.id === id && t.status === "completed");
}

export function getTx(id: string): CoinTransaction | undefined {
  return readLedger().find((t) => t.id === id);
}

export function recordPendingTx(
  input: Omit<CoinTransaction, "status" | "at"> & { at?: number },
): CoinTransaction {
  const existing = getTx(input.id);
  if (existing) return existing;

  const row: CoinTransaction = {
    ...input,
    status: "pending",
    at: input.at ?? Date.now(),
  };
  const ledger = readLedger();
  ledger.push(row);
  writeLedger(ledger);
  return row;
}

export function markTxCompleted(
  id: string,
  patch?: Partial<Pick<CoinTransaction, "serverId" | "meta">>,
): CoinTransaction | null {
  const ledger = readLedger();
  const i = ledger.findIndex((t) => t.id === id);
  if (i < 0) return null;
  ledger[i] = {
    ...ledger[i]!,
    status: "completed",
    serverId: patch?.serverId ?? ledger[i]!.serverId,
    meta: { ...ledger[i]!.meta, ...patch?.meta },
  };
  writeLedger(ledger);
  return ledger[i]!;
}

export function markTxFailed(id: string, error: string): void {
  const ledger = readLedger();
  const i = ledger.findIndex((t) => t.id === id);
  if (i < 0) return;
  ledger[i] = { ...ledger[i]!, status: "failed", error };
  writeLedger(ledger);
}

export function markTxRolledBack(id: string, error?: string): void {
  const ledger = readLedger();
  const i = ledger.findIndex((t) => t.id === id);
  if (i < 0) return;
  ledger[i] = {
    ...ledger[i]!,
    status: "rolled_back",
    error: error ?? ledger[i]!.error,
  };
  writeLedger(ledger);
}

export function listCoinTransactions(limit = 80): CoinTransaction[] {
  return readLedger()
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

/** Sum completed ledger entries — diagnostic vs server balance. */
export function ledgerBalanceHint(startingBalance = 0): number {
  let bal = startingBalance;
  for (const t of readLedger()) {
    if (t.status !== "completed") continue;
    if (t.type === "refund" || t.type === "recharge" || t.type === "bonus" || t.type === "referral" || t.type === "vip") {
      bal += t.amount;
    } else {
      bal -= t.amount;
    }
  }
  return bal;
}

export function reconcileWithServer(
  serverBalance: number,
  tolerance = 0,
): { ok: boolean; drift: number } {
  const pending = readLedger().filter((t) => t.status === "pending");
  if (pending.length > 0) {
    return { ok: false, drift: 0 };
  }
  return { ok: true, drift: 0 };
}
