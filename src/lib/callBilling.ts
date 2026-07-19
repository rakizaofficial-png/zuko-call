/**
 * Per-minute call billing via CoinCall API (user → host transfer).
 */

import { requireApiBase } from "@/config/apiConfig";
import { getDeviceUserId } from "@/lib/walletApi";

export async function billCallMinute(callId: string): Promise<{
  ok: boolean;
  exhausted: boolean;
  amount?: number;
  coinBalance?: number;
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
      body: JSON.stringify({ userId }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    amount?: number;
    userWallet?: { coinBalance?: number };
  };
  if (res.status === 402) {
    return {
      ok: false,
      exhausted: true,
      error: data.error || "Coins exhausted",
      coinBalance: data.userWallet?.coinBalance,
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
    coinBalance: data.userWallet?.coinBalance,
  };
}
