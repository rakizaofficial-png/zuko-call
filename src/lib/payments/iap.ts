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
  const nativeBridge = (
    window as unknown as {
      LumaNativeIap?: {
        restore?: () => Promise<
          Array<{
            platform: IapPlatform;
            productId: string;
            purchaseToken: string;
          }>
        >;
        finish?: (purchaseToken: string) => Promise<void>;
      };
    }
  ).LumaNativeIap;

  if (nativeBridge?.restore) {
    try {
      const purchases = await nativeBridge.restore();
      let restoredCount = 0;
      let latestBalance: number | undefined;

      for (const purchase of purchases) {
        const product = getIapProduct(purchase.productId);
        if (!product || !purchase.purchaseToken) continue;
        const verified = await verifyIapPurchase({
          userId: id,
          productId: product.productId,
          platform: purchase.platform || "google",
          purchaseToken: purchase.purchaseToken,
        });
        await nativeBridge.finish?.(purchase.purchaseToken);
        restoredCount += 1;
        latestBalance = verified.balance;
      }

      return {
        restored: restoredCount > 0,
        balance: latestBalance,
        message:
          restoredCount > 0
            ? `${restoredCount} purchase restored`
            : "No pending purchases to restore",
      };
    } catch (e) {
      return {
        restored: false,
        message: e instanceof Error ? e.message : "Restore unavailable",
      };
    }
  }

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

  const nativeWindow = window as unknown as {
    __ZUKO_ANDROID__?: number;
    ZukoNativeIap?: {
      isNativeGooglePlay?: boolean;
      purchase: (sku: string) => Promise<{
        platform: IapPlatform;
        productId?: string;
        purchaseToken: string;
      }>;
      finish?: (purchaseToken: string) => Promise<void>;
    };
    LumaNativeIap?: {
      isNativeGooglePlay?: boolean;
      purchase: (sku: string) => Promise<{
        platform: IapPlatform;
        productId?: string;
        purchaseToken: string;
      }>;
      finish?: (purchaseToken: string) => Promise<void>;
    };
  };
  const bridge =
    nativeWindow.ZukoNativeIap ||
    nativeWindow.LumaNativeIap;

  if (bridge?.purchase) {
    const product = getIapProduct(input.productId);
    if (!product) throw new Error("Unknown product");
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
      await bridge.finish?.(native.purchaseToken);
      markTxCompleted(txId, { serverId: verified.transactionId });
      return verified;
    }
    throw new Error("Google Play did not return a purchase token");
  }

  // Never send an Android app user to a hosted/browser checkout. Play builds
  // must open the native Google Play purchase sheet through the RN bridge.
  if (nativeWindow.__ZUKO_ANDROID__) {
    throw new Error(
      "Google Play Billing is not connected. Reopen Zuko from the Play Store internal test track and try again.",
    );
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
