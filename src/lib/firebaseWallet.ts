/**
 * Free-tier Firebase RTDB wallet transfers (no Cloud Functions).
 * Atomic per-path transactions: deduct user → credit host.
 */

import { get, ref, runTransaction, set, update } from "firebase/database";
import { getFirebaseDb, isFirebaseReady } from "@/lib/firebase";

export type FbWallet = {
  userId: string;
  coinBalance: number;
  xp: number;
  displayName?: string;
  role?: "user" | "host";
  updatedAt: number;
};

function walletRef(userId: string) {
  return ref(getFirebaseDb()!, `wallets/${userId}`);
}

export async function ensureFbWallet(
  userId: string,
  seed?: { coinBalance?: number; displayName?: string; role?: "user" | "host" },
): Promise<FbWallet | null> {
  if (!isFirebaseReady() || !userId) return null;
  const db = getFirebaseDb()!;
  const snap = await get(walletRef(userId));
  if (snap.exists()) {
    const row = snap.val() as FbWallet;
    return {
      userId,
      coinBalance: Number(row.coinBalance || 0),
      xp: Number(row.xp || 0),
      displayName: row.displayName,
      role: row.role,
      updatedAt: Number(row.updatedAt || Date.now()),
    };
  }
  const created: FbWallet = {
    userId,
    coinBalance: Math.max(0, Math.floor(seed?.coinBalance ?? 0)),
    xp: 0,
    displayName: seed?.displayName,
    role: seed?.role || "user",
    updatedAt: Date.now(),
  };
  await set(walletRef(userId), created);
  return created;
}

export async function getFbBalance(userId: string): Promise<number | null> {
  if (!isFirebaseReady() || !userId) return null;
  const snap = await get(walletRef(userId));
  if (!snap.exists()) return null;
  return Number((snap.val() as FbWallet).coinBalance || 0);
}

/**
 * Per-minute transfer: user pays `amount`, host receives `amount`.
 * Returns exhausted=true when user cannot cover the rate.
 */
export async function transferCallMinuteFb(input: {
  userId: string;
  hostId: string;
  amount: number;
  callId: string;
  minuteIndex: number;
  userName?: string;
  hostName?: string;
}): Promise<{
  ok: boolean;
  exhausted: boolean;
  amount?: number;
  userBalance?: number;
  hostBalance?: number;
  error?: string;
}> {
  if (!isFirebaseReady()) {
    return { ok: false, exhausted: false, error: "Firebase unavailable" };
  }
  const amount = Math.max(1, Math.floor(input.amount));
  if (input.userId === input.hostId) {
    return { ok: false, exhausted: false, error: "Hosts cannot gift themselves!" };
  }

  const db = getFirebaseDb()!;
  const minuteKey = String(Math.max(1, input.minuteIndex));
  const billedRef = ref(db, `callBilling/${input.callId}/minutes/${minuteKey}`);
  const prior = await get(billedRef);
  if (prior.exists()) {
    const row = prior.val() as { userBalance?: number };
    return {
      ok: true,
      exhausted: false,
      amount,
      userBalance: Number(row.userBalance ?? 0),
    };
  }

  await ensureFbWallet(input.userId, {
    displayName: input.userName,
    role: "user",
  });
  await ensureFbWallet(input.hostId, {
    displayName: input.hostName,
    role: "host",
  });

  let userBalance = 0;
  const debit = await runTransaction(walletRef(input.userId), (current) => {
    const row = (current || {}) as Partial<FbWallet>;
    const bal = Number(row.coinBalance || 0);
    if (bal < amount) {
      return; // abort
    }
    userBalance = bal - amount;
    return {
      userId: input.userId,
      coinBalance: userBalance,
      xp: Number(row.xp || 0) + amount,
      displayName: row.displayName || input.userName,
      role: row.role || "user",
      updatedAt: Date.now(),
    };
  });

  if (!debit.committed) {
    const snap = await get(walletRef(input.userId));
    const bal = snap.exists()
      ? Number((snap.val() as FbWallet).coinBalance || 0)
      : 0;
    return {
      ok: false,
      exhausted: bal < amount,
      userBalance: bal,
      error: "Coins exhausted",
    };
  }

  let hostBalance = 0;
  const credit = await runTransaction(walletRef(input.hostId), (current) => {
    const row = (current || {}) as Partial<FbWallet>;
    hostBalance = Number(row.coinBalance || 0) + amount;
    return {
      userId: input.hostId,
      coinBalance: hostBalance,
      xp: Number(row.xp || 0) + amount,
      displayName: row.displayName || input.hostName,
      role: "host",
      updatedAt: Date.now(),
    };
  });

  if (!credit.committed) {
    // Best-effort rollback user debit
    await runTransaction(walletRef(input.userId), (current) => {
      const row = (current || {}) as Partial<FbWallet>;
      return {
        ...row,
        userId: input.userId,
        coinBalance: Number(row.coinBalance || 0) + amount,
        updatedAt: Date.now(),
      };
    });
    return { ok: false, exhausted: false, error: "Host credit failed" };
  }

  // Persist call minute + weekly host earnings (free-tier RTDB, no Cloud Functions)
  const weekKey = currentWeekKey();
  const weekStart = startOfWeekMs();
  await Promise.all([
    set(billedRef, {
      amount,
      userId: input.userId,
      hostId: input.hostId,
      userBalance,
      hostBalance,
      at: Date.now(),
    }).catch(() => undefined),
    runTransaction(ref(db, `callSessions/${input.callId}`), (cur) => {
      if (!cur || typeof cur !== "object") return cur;
      const row = cur as Record<string, unknown>;
      return {
        ...row,
        billedMinutes: Number(row.billedMinutes || 0) + 1,
        coinsSpent: Number(row.coinsSpent || 0) + amount,
        lastBilledAt: Date.now(),
        updatedAt: Date.now(),
      };
    }).catch(() => undefined),
    runTransaction(
      ref(db, `hosts/${input.hostId}/weeklyEarnings/${weekKey}`),
      (cur) => {
        const row = (cur || {}) as Record<string, number | string>;
        return {
          weekKey,
          weekStart,
          coins: Number(row.coins || 0) + amount,
          callMinutes: Number(row.callMinutes || 0) + 1,
          callCount: Number(row.callCount || 0),
          giftCoins: Number(row.giftCoins || 0),
          updatedAt: Date.now(),
        };
      },
    ).catch(() => undefined),
    runTransaction(ref(db, `hosts/${input.hostId}/stats`), (cur) => {
      const row = (cur || {}) as Record<string, number>;
      return {
        totalCallCoins: Number(row.totalCallCoins || 0) + amount,
        totalMinutes: Number(row.totalMinutes || 0) + 1,
        totalCalls: Number(row.totalCalls || 0),
        updatedAt: Date.now(),
      };
    }).catch(() => undefined),
    update(ref(db, `hosts/${input.hostId}`), {
      coinBalance: hostBalance,
      walletUpdatedAt: Date.now(),
    }).catch(() => undefined),
  ]);

  return {
    ok: true,
    exhausted: false,
    amount,
    userBalance,
    hostBalance,
  };
}

function currentWeekKey(d = new Date()) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfWeekMs(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x.getTime();
}
