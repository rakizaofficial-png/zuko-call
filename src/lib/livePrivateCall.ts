/**
 * Live → Private Video Call helpers (reserve / refund / history).
 */

import { requireApiBase } from "@/config/apiConfig";
import {
  creditCoinsApi,
  getDeviceUserId,
  spendCoinsApi,
} from "@/lib/walletApi";
import {
  markTxCompleted,
  markTxFailed,
  markTxRolledBack,
  recordPendingTx,
} from "@/lib/coinLedger";
import type { LiveHost } from "@/lib/api";

const HISTORY_KEY = "zuko_live_private_call_history_v1";

export type LivePrivateCallHistoryRow = {
  id: string;
  hostId: string;
  hostName: string;
  at: number;
  durationSec: number;
  coinsSpent: number;
  status:
    | "accepted"
    | "rejected"
    | "missed"
    | "cancelled"
    | "ended"
    | "insufficient"
    | "offline";
  ratePerMinute: number;
};

export function hostAcceptsLiveCalls(host: LiveHost | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (!host) return { ok: false, reason: "Host unavailable" };
  // Live hosts are always callable from Live → Private Video Call.
  // Presence readyToCall can lag; the /calls API remains authoritative.
  if (host.isLive) {
    if (host.isOnCall) {
      return { ok: false, reason: "Host is already on a private call" };
    }
    return { ok: true };
  }
  if (!host.isOnline) {
    return { ok: false, reason: "Host is offline" };
  }
  if (host.isOnCall) {
    return { ok: false, reason: "Host is already on a private call" };
  }
  if (host.readyToCall === false) {
    return { ok: false, reason: "Host is not accepting private calls" };
  }
  return { ok: true };
}

export function estimateCallMinutes(balance: number, ratePerMinute: number) {
  const rate = Math.max(1, Math.floor(ratePerMinute));
  return Math.floor(Math.max(0, balance) / rate);
}

/** Reserve first minute so reject/cancel can refund cleanly. */
export async function reserveCallMinute(input: {
  callId: string;
  amount: number;
  hostId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const txId = `tx_reserve_${input.callId}`;
  const userId = getDeviceUserId();
  recordPendingTx({
    id: txId,
    userId,
    amount: input.amount,
    type: "call_minute",
    reason: `live_call_reserve_${input.callId}`,
    hostId: input.hostId,
    callId: input.callId,
  });
  try {
    await spendCoinsApi({
      amount: input.amount,
      reason: `live_call_reserve_${input.callId}`,
      clientTxId: txId,
      meta: { hostId: input.hostId, callId: input.callId, reserved: true },
    });
    markTxCompleted(txId);
    return { ok: true };
  } catch (e) {
    markTxFailed(txId, e instanceof Error ? e.message : "reserve failed");
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reserve coins",
    };
  }
}

export async function refundCallReserve(input: {
  callId: string;
  amount: number;
  hostId: string;
}): Promise<void> {
  const txId = `tx_refund_reserve_${input.callId}`;
  const userId = getDeviceUserId();
  recordPendingTx({
    id: txId,
    userId,
    amount: input.amount,
    type: "refund",
    reason: `live_call_refund_${input.callId}`,
    hostId: input.hostId,
    callId: input.callId,
  });
  try {
    await creditCoinsApi({
      amount: input.amount,
      reason: `live_call_refund_${input.callId}`,
      clientTxId: txId,
      meta: { hostId: input.hostId, callId: input.callId },
    });
    markTxCompleted(txId);
  } catch (e) {
    markTxRolledBack(txId, e instanceof Error ? e.message : "refund failed");
    // Best-effort alternate endpoint
    try {
      await fetch(`${requireApiBase()}/wallet/credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          userId,
          amount: input.amount,
          reason: `live_call_refund_${input.callId}`,
          clientTxId: txId,
        }),
      });
    } catch {
      /* server may auto-release unpaid reserves */
    }
  }
}

export function saveLivePrivateCallHistory(row: LivePrivateCallHistoryRow) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as LivePrivateCallHistoryRow[]) : [];
    const terminal = new Set([
      "ended",
      "rejected",
      "missed",
      "cancelled",
      "insufficient",
      "offline",
    ]);
    const idx = list.findIndex((r) => r.id === row.id);
    if (idx >= 0) {
      const prev = list[idx];
      // Don't overwrite a terminal row with intermediate "accepted"
      if (terminal.has(prev.status) && row.status === "accepted") {
        return;
      }
      const merged = { ...prev, ...row };
      const rest = list.filter((r) => r.id !== row.id);
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify([merged, ...rest].slice(0, 80)),
      );
      return;
    }
    list.unshift(row);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {
    /* ignore */
  }
}

export function listLivePrivateCallHistory(): LivePrivateCallHistoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LivePrivateCallHistoryRow[]) : [];
  } catch {
    return [];
  }
}

/** Best-effort notify — createCall already rings the host app. */
export async function notifyLivePrivateCallRequest(input: {
  hostId: string;
  callId: string;
  userId: string;
  userName: string;
  ratePerMinute: number;
  roomId?: string;
}) {
  try {
    await fetch(`${requireApiBase()}/calls/${encodeURIComponent(input.callId)}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": input.userId,
      },
      body: JSON.stringify({
        source: "live",
        hostId: input.hostId,
        userId: input.userId,
        userName: input.userName,
        ratePerMinute: input.ratePerMinute,
        roomId: input.roomId,
      }),
    });
  } catch {
    /* optional endpoint */
  }
}
