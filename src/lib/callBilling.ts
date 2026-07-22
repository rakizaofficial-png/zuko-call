/**
 * Per-minute call billing via CoinCall API (user → host transfer).
 */

import { requireApiBase } from "@/config/apiConfig";
import { getDeviceUserId } from "@/lib/walletApi";

export async function billCallMinute(
  callId: string,
  opts?: {
    clientTxId?: string;
    minuteIndex?: number;
    hostId?: string;
  },
): Promise<{
  ok: boolean;
  exhausted: boolean;
  amount?: number;
  coinBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  const userId = getDeviceUserId();
  const res = await fetch(
    `${requireApiBase()}/calls/${encodeURIComponent(callId)}/minute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        userId,
        clientTxId: opts?.clientTxId,
        minuteIndex: opts?.minuteIndex,
        hostId: opts?.hostId,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    amount?: number;
    transactionId?: string;
    userWallet?: { coinBalance?: number };
    wallet?: { coinBalance?: number };
  };
  const coinBalance =
    data.userWallet?.coinBalance ?? data.wallet?.coinBalance;
  if (res.status === 402) {
    return {
      ok: false,
      exhausted: true,
      error: data.error || "Coins exhausted",
      coinBalance,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      exhausted: false,
      error: data.error || `Bill failed (${res.status})`,
    };
  }
  return {
    ok: true,
    exhausted: false,
    amount: data.amount,
    coinBalance,
    transactionId: data.transactionId,
  };
}
