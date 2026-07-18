/**
 * ============================================================================
 * WALLET + USER PROFILE API CLIENT (PRODUCTION)
 * ============================================================================
 * All balances / XP / VIP come from the CoinCall API — never hardcode.
 * Auth: pass Bearer token from your login session (Supabase/Firebase/custom JWT).
 */

import { env } from "@/config/env";

export type UserWallet = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  coins: number;
  xp: number;
  isPremium: boolean;
  following: string[];
};

export type CoinPackDto = {
  id: string;
  sku: string;
  coins: number;
  bonus?: number;
  priceLabel: string;
  platformProductId: {
    google: string;
    apple: string;
  };
  popular?: boolean;
  best?: boolean;
};

function authHeaders(token?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `HTTP ${res.status}`,
    );
  }
  return data as T;
}

/** Resolve or create the signed-in user wallet from the API */
export async function fetchWallet(token?: string | null): Promise<UserWallet> {
  const res = await fetch(`${env.apiBaseUrl}/wallet/me`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const data = await parse<{ wallet: UserWallet }>(res);
  return data.wallet;
}

/** Server-authoritative coin spend (call billing, gifts) */
export async function spendCoinsApi(
  amount: number,
  reason: string,
  token?: string | null,
): Promise<UserWallet> {
  const res = await fetch(`${env.apiBaseUrl}/wallet/spend`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ amount, reason }),
  });
  const data = await parse<{ wallet: UserWallet }>(res);
  return data.wallet;
}

/** After IAP / Play Billing verification succeeds on server */
export async function creditCoinsApi(
  amount: number,
  reason: string,
  token?: string | null,
): Promise<UserWallet> {
  const res = await fetch(`${env.apiBaseUrl}/wallet/credit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ amount, reason }),
  });
  const data = await parse<{ wallet: UserWallet }>(res);
  return data.wallet;
}

export async function fetchCoinPacks(
  token?: string | null,
): Promise<CoinPackDto[]> {
  const res = await fetch(`${env.apiBaseUrl}/wallet/packs`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const data = await parse<{ packs: CoinPackDto[] }>(res);
  return data.packs ?? [];
}

export async function verifyIapReceipt(input: {
  platform: "google" | "apple";
  productId: string;
  purchaseToken: string;
  receiptData?: string;
  token?: string | null;
}): Promise<UserWallet> {
  const res = await fetch(`${env.apiBaseUrl}/wallet/iap/verify`, {
    method: "POST",
    headers: authHeaders(input.token),
    body: JSON.stringify({
      platform: input.platform,
      productId: input.productId,
      purchaseToken: input.purchaseToken,
      receiptData: input.receiptData,
    }),
  });
  const data = await parse<{ wallet: UserWallet }>(res);
  return data.wallet;
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("luma_auth_token") ||
    localStorage.getItem("coincall_user_token")
  );
}

export function setSessionToken(token: string) {
  localStorage.setItem("luma_auth_token", token);
}
