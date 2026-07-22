/**
 * =============================================================================
 * NATIVE IAP BRIDGE (Google Play Billing / Apple StoreKit)
 * =============================================================================
 *
 * WEB / NEXT.JS NOTE:
 * Browser builds cannot talk to Play Billing or StoreKit directly.
 * - In Expo / React Native shell: install `react-native-iap` or `expo-in-app-purchases`
 * - Call `purchaseProductNative()` from the native bridge
 * - Always finish with `verifyIapPurchase()` against CoinCall API
 *
 * WEB FALLBACK:
 * `purchaseProductWebCheckout()` opens your Play/App Store listing or a
 * server-hosted billing session URL returned by `/api/wallet/iap/session`.
 * =============================================================================
 */

import { requireApiBase } from "@/config/apiConfig";
import { getAuthHeaders } from "@/lib/authSession";
import { getDeviceUserId } from "@/lib/walletApi";
import { getIapProduct } from "./iapCatalog";
import { markTxCompleted, recordPendingTx } from "@/lib/coinLedger";

export type IapPlatform = "google" | "apple" | "web";

export type VerifyIapResult = {
  ok: boolean;
  balance: number;
  credited: number;
  transactionId: string;
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = requireApiBase();
  const userId = getDeviceUserId();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `IAP request failed (${res.status})`);
  }
  return data as T;
}

/**
 * Verify a native purchase token with the backend (authoritative credit).
 */
export async function verifyIapPurchase(input: {
  userId: string;
  productId: string;
  platform: IapPlatform;
  /** Google purchaseToken or Apple transaction receipt / JWS */
  purchaseToken: string;
}): Promise<VerifyIapResult> {
  const product = getIapProduct(input.productId);
  if (!product) throw new Error(`Unknown productId: ${input.productId}`);

  // Authoritative credit is server-side from productId catalog.
  // expectedCoins retained for older API handlers only.
  return apiJson<VerifyIapResult>("/wallet/iap/verify", {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      productId: input.productId,
      platform: input.platform,
      purchaseToken: input.purchaseToken,
      expectedCoins: product.coins + product.bonusCoins,
    }),
  });
}

/** Restore / re-query last Play purchase session after reinstall. */
export async function restorePurchases(userId?: string): Promise<{
  restored: boolean;
  balance?: number;
  message: string;
}> {
  const id = userId || getDeviceUserId();
  try {
    const data = await apiJson<{
      ok?: boolean;
      balance?: number;
      restored?: boolean;
    }>("/wallet/iap/restore", {
      method: "POST",
      body: JSON.stringify({ userId: id, platform: "google" }),
    });
    return {
      restored: Boolean(data.restored || data.ok),
      balance: data.balance,
      message: data.restored
        ? "Purchases restored"
        : "No pending purchases to restore",
    };
  } catch (e) {
    // Fallback: refresh wallet (install-id restore path)
    return {
      restored: false,
      message: e instanceof Error ? e.message : "Restore unavailable",
    };
  }
}

/**
 * Ask backend for a hosted checkout / Play Billing deep-link session.
 * Use this on web until the native shell is ready.
 */
export async function createIapCheckoutSession(input: {
  userId: string;
  productId: string;
  platform?: IapPlatform;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  return apiJson("/wallet/iap/session", {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      productId: input.productId,
      platform: input.platform || "web",
    }),
  });
}

/**
 * Production entry: prefer native bridge when injected on window by RN WebView.
 * Falls back to server checkout session for browser.
 */
export async function purchaseCoins(input: {
  userId: string;
  productId: string;
}): Promise<VerifyIapResult | { redirected: true; checkoutUrl: string }> {
  /** Always credit the device profile id — never a random/temp id */
  const userId = getDeviceUserId() || input.userId;
  if (!userId) throw new Error("Profile not ready — reopen the app");

  const bridge = (
    window as unknown as {
      LumaNativeIap?: {
        purchase: (sku: string) => Promise<{
          platform: IapPlatform;
          purchaseToken: string;
        }>;
      };
    }
  ).LumaNativeIap;

  if (bridge?.purchase) {
    const product = getIapProduct(input.productId);
    if (!product) throw new Error("Unknown product");
    try {
      const native = await bridge.purchase(product.platformSku.google);
      if (native?.purchaseToken) {
        const txId = `tx_iap_${input.productId}_${native.purchaseToken.slice(0, 24)}`;
        recordPendingTx({
          id: txId,
          userId,
          amount: product.coins + product.bonusCoins,
          type: "recharge",
          reason: `iap_${input.productId}`,
        });
        const verified = await verifyIapPurchase({
          userId,
          productId: input.productId,
          platform: native.platform || "google",
          purchaseToken: native.purchaseToken,
        });
        markTxCompleted(txId, { serverId: verified.transactionId });
        return verified;
      }
    } catch {
      // Fall through to hosted Play checkout when native billing isn't linked.
    }
  }

  const session = await createIapCheckoutSession({
    userId,
    productId: input.productId,
    platform: "google",
  });
  try {
    sessionStorage.setItem(
      "zuko_iap_pending_v1",
      JSON.stringify({
        productId: input.productId,
        sessionId: session.sessionId,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
  // Route through in-app result screen after return when possible.
  const checkoutUrl = session.checkoutUrl;
  window.location.href = checkoutUrl;
  return { redirected: true, checkoutUrl };
}
