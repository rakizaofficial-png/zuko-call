/**
 * =============================================================================
 * WALLET + USER PROFILE — LIVE API (no hardcoded balances)
 * =============================================================================
 */

import { requireApiBase } from "@/config/apiConfig";
import { getAuthHeaders, getSession } from "@/lib/authSession";
import {
  adoptRestoredUserId,
  ensureDeviceUserId,
  ensureInstallId,
  ensureLocalProfile,
  hasWelcomeBonusClaimed,
  isGenericDisplayName,
  markWelcomeBonusClaimed,
  updateLocalAvatar,
  updateLocalBio,
  updateLocalDisplayName,
} from "@/lib/userProfile";

export type WalletSnapshot = {
  userId: string;
  coinBalance: number;
  xp: number;
  isPremium: boolean;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  appId?: string;
  created?: boolean;
  /** True only when server actually credited welcome this request */
  welcomeBonus?: boolean;
};

function deviceUserId(): string {
  return ensureDeviceUserId();
}

export function getDeviceUserId() {
  return deviceUserId();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = requireApiBase();
  const session = typeof window !== "undefined" ? getSession() : null;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": deviceUserId(),
      "X-Install-Id": ensureInstallId(),
      ...getAuthHeaders(),
      ...(session?.user?.id
        ? { "X-Account-Id": session.user.id }
        : {}),
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
  const data = await api<{
    wallet: WalletSnapshot;
    created?: boolean;
    welcomeBonus?: boolean;
    restored?: boolean;
    restoredUserId?: string;
  }>("/wallet/me", {
    method: "POST",
    body: JSON.stringify({
      userId: local.userId,
      displayName: local.displayName,
      avatarUrl: local.avatarUrl,
      bio: local.bio || "",
      welcomeAlreadyClaimed: hasWelcomeBonusClaimed(local.userId),
      installId: ensureInstallId(),
    }),
  });
  let wallet = data.wallet;
  const welcomeBonus = Boolean(data.welcomeBonus);

  if (
    data.restored &&
    data.restoredUserId &&
    data.restoredUserId !== local.userId
  ) {
    adoptRestoredUserId(data.restoredUserId, {
      displayName: wallet.displayName,
      avatarUrl: wallet.avatarUrl,
      bio: wallet.bio,
      appId: wallet.appId,
    });
  }

  if (welcomeBonus || data.created) {
    markWelcomeBonusClaimed(wallet.userId || local.userId);
  }

  // Prefer unique local identity over generic server defaults
  if (
    wallet.displayName &&
    !isGenericDisplayName(wallet.displayName) &&
    wallet.displayName !== local.displayName
  ) {
    updateLocalDisplayName(wallet.displayName);
  } else if (
    isGenericDisplayName(wallet.displayName) &&
    !isGenericDisplayName(local.displayName)
  ) {
    void api("/wallet/me", {
      method: "POST",
      body: JSON.stringify({
        userId: wallet.userId || local.userId,
        displayName: local.displayName,
        avatarUrl: local.avatarUrl,
        bio: local.bio || "",
        updateProfile: true,
        welcomeAlreadyClaimed: true,
      }),
    }).catch(() => undefined);
  }

  if (wallet.avatarUrl && wallet.avatarUrl !== local.avatarUrl) {
    updateLocalAvatar(wallet.avatarUrl);
  }
  if (wallet.bio != null && wallet.bio !== (local.bio || "")) {
    updateLocalBio(wallet.bio);
  }

  return {
    ...wallet,
    displayName: isGenericDisplayName(wallet.displayName)
      ? local.displayName
      : wallet.displayName || local.displayName,
    avatarUrl: wallet.avatarUrl || local.avatarUrl,
    bio: wallet.bio ?? local.bio ?? "",
    created: Boolean(data.created),
    welcomeBonus,
  };
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
      bio: local.bio || "",
      updateProfile: true,
    }),
  });
  return data.wallet;
}

/** Update avatar on device + server */
export async function updateProfileAvatar(
  avatarUrl: string,
): Promise<WalletSnapshot> {
  const local = updateLocalAvatar(avatarUrl);
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/me", {
    method: "POST",
    body: JSON.stringify({
      userId: local.userId,
      displayName: local.displayName,
      avatarUrl: local.avatarUrl,
      bio: local.bio || "",
      updateProfile: true,
    }),
  });
  return data.wallet;
}

/** Update bio on device + server */
export async function updateProfileBio(bio: string): Promise<WalletSnapshot> {
  const local = updateLocalBio(bio);
  const data = await api<{ wallet: WalletSnapshot }>("/wallet/me", {
    method: "POST",
    body: JSON.stringify({
      userId: local.userId,
      displayName: local.displayName,
      avatarUrl: local.avatarUrl,
      bio: local.bio || "",
      updateProfile: true,
    }),
  });
  return data.wallet;
}

/**
 * Upload compressed gallery image → durable API avatar URL + wallet sync.
 * onProgress: 0–100 (compress + upload).
 */
export async function uploadProfileAvatar(
  dataUrl: string,
  onProgress?: (pct: number) => void,
): Promise<WalletSnapshot> {
  const userId = deviceUserId();
  onProgress?.(5);
  const base = requireApiBase();
  onProgress?.(25);
  const res = await fetch(
    `${base}/users/${encodeURIComponent(userId)}/avatar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
        "X-Install-Id": ensureInstallId(),
      },
      body: JSON.stringify({ image: dataUrl }),
      cache: "no-store",
    },
  );
  onProgress?.(75);
  const data = (await res.json()) as { avatarUrl?: string; error?: string };
  if (!res.ok || !data.avatarUrl) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  onProgress?.(90);
  const wallet = await updateProfileAvatar(data.avatarUrl);
  onProgress?.(100);
  return wallet;
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
