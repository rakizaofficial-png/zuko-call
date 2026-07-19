/**
 * Call history from CoinCall API (user side).
 */

import { requireApiBase } from "@/config/apiConfig";
import { getDeviceUserId } from "@/lib/walletApi";

export type CallHistoryRow = {
  id: string;
  hostId: string;
  hostName: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  ratePerMinute: number;
  billedMinutes: number;
  coinsSpent: number;
  status: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  endReason: string;
};

export async function fetchUserCallHistory(limit = 50): Promise<{
  calls: CallHistoryRow[];
  summary: {
    totalCalls: number;
    totalCoinsSpent: number;
    totalDurationSec: number;
  };
}> {
  const userId = getDeviceUserId();
  const res = await fetch(
    `${requireApiBase()}/users/${encodeURIComponent(userId)}/calls?limit=${limit}`,
    {
      headers: { "X-User-Id": userId },
      cache: "no-store",
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    calls?: CallHistoryRow[];
    summary?: {
      totalCalls: number;
      totalCoinsSpent: number;
      totalDurationSec: number;
    };
  };
  if (!res.ok) {
    throw new Error(data.error || `Call history failed (${res.status})`);
  }
  return {
    calls: data.calls || [],
    summary: data.summary || {
      totalCalls: 0,
      totalCoinsSpent: 0,
      totalDurationSec: 0,
    },
  };
}

export function formatCallDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
