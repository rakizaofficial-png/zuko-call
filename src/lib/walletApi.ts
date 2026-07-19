/**
 * =============================================================================
 * WALLET + USER PROFILE — LIVE API (no hardcoded balances)
 * =============================================================================
 */

import { requireApiBase } from "@/config/apiConfig";
import {
  ensureDeviceUserId,
  ensureLocalProfile,
  updateLocalDisplayName,
} from "@/lib/userProfile";

export type WalletSnapshot = {
  userId: string;
  coinBalance: number;
  xp: number;
  isPremium: boolean;
  displayName: string;
  avatarUrl?: string;
  appId?: string;
  created?: boolean;
};

function deviceUserId(): string {
  return ensureDeviceUserId();
}

export function getDeviceUserId() {
  return deviceUserId();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = requireApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": deviceUserId(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data as T;
}

/**
 * Auto-create local + server profile/wallet for this device user id.
 * Purchases and spends always use the same id.
 */
export async function fetchOrCreateWallet(): Promise<WalletSnapshot> {
  const local = ensureLocalProfile();
  const data = await api<{ wallet: WalletSnapshot; created?: boolean }>(
    "/wallet/me",
    {
      method: "POST",
      body: JSON.stringify({
        userId: local.userId,
        displayName: local.displayName,
        avatarUrl: local.avatarUrl,
      }),
    },
  );
  const wallet = data.wallet;
  if (wallet.displayName && wallet.displayName !== local.displayName) {
    updateLocalDisplayName(wallet.displayName);
  }
  return { ...wallet, created: Boolean(data.created) };
}

/** Update display name on device + server (same userId) */
export async function updateProfileName(
  displayName: string,
): Promise<WalletSnapshot> {
  const local = updateLocalDisplayName(displayName);
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/me", {
    method: "POST",
    body: JSON.stringify({
      userId: local.userId,
      displayName: local.displayName,
      avatarUrl: local.avatarUrl,
      updateProfile: true,
    }),
  });
  return data.wallet;
}

export async function refreshWallet(): Promise<WalletSnapshot> {
  const userId = deviceUserId();
  const data = await api<{ wallet: WalletSnapshot }>(
    `/wallet/${encodeURIComponent(userId)}`,
  );
  return data.wallet;
}

/** Authoritative spend — server rejects if balance insufficient */
export async function spendCoinsApi(input: {
  amount: number;
  reason: string;
  meta?: Record<string, unknown>;
}): Promise<WalletSnapshot> {
  const userId = deviceUserId();
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/spend", {
    method: "POST",
    body: JSON.stringify({
      userId,
      amount: input.amount,
      reason: input.reason,
      meta: input.meta,
    }),
  });
  return data.wallet;
}

/** Credit coins (rewards, check-in, spin, referral) — server authoritative */
export async function creditCoinsApi(input: {
  amount: number;
  reason: string;
}): Promise<WalletSnapshot> {
  const userId = deviceUserId();
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/credit", {
    method: "POST",
    body: JSON.stringify({
      userId,
      amount: input.amount,
      reason: input.reason,
    }),
  });
  return data.wallet;
}

export type WalletLedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  kind: "credit" | "spend";
  at: number;
};

export async function fetchWalletHistory(): Promise<WalletLedgerEntry[]> {
  const userId = deviceUserId();
  try {
    const data = await api<{ history: WalletLedgerEntry[] }>(
      `/wallet/history/${encodeURIComponent(userId)}`,
    );
    return data.history ?? [];
  } catch {
    return [];
  }
}

export async function setPremiumApi(input: {
  isPremium: boolean;
  planId?: string;
}): Promise<WalletSnapshot> {
  const userId = deviceUserId();
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/premium", {
    method: "POST",
    body: JSON.stringify({
      userId,
      isPremium: input.isPremium,
      planId: input.planId,
    }),
  });
  return data.wallet;
}

export async function fetchCoinCatalog(): Promise<
  {
    productId: string;
    coins: number;
    bonusCoins: number;
    priceLabel: string;
    title: string;
    popular?: boolean;
  }[]
> {
  try {
    const data = await api<{
      products: {
        productId: string;
        coins: number;
        bonusCoins: number;
        priceLabel: string;
        title: string;
        popular?: boolean;
      }[];
    }>("/wallet/products");
    return data.products;
  } catch {
    const { IAP_PRODUCTS } = await import("./payments/iapCatalog");
    return IAP_PRODUCTS;
  }
}
