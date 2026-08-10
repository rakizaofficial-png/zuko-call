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
import { getAuthHeaders, getSession } from "@/lib/authSession";
import { getDeviceUserId } from "@/lib/walletApi";
import { getIapProduct, isKnownIapProduct } from "./iapCatalog";
import { markTxCompleted, recordPendingTx } from "@/lib/coinLedger";

export type IapPlatform = "google" | "apple" | "web";

export type VerifyIapResult = {
  ok: boolean;
  balance: number;
  credited: number;
  transactionId: string;
};

type PaymentApiTransaction = {
  id: string;
  status: string;
  walletBalance: number;
  coinsGranted: number;
};

type GoogleVerifyResponse =
  | { ok: true; transaction: PaymentApiTransaction }
  | { ok: false; pending?: boolean; error?: string; message?: string };

function billingAccountId(): string {
  const id = String(getSession()?.user?.id || "").trim();
  // The same authenticated account identifier is attached to the Play purchase
  // and validated again by the backend. Device-only identities cannot buy.
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    throw new Error("Sign in to your Zuko account before making a purchase.");
  }
  return id;
}

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
    // The payment API intentionally returns a safe customer-facing message
    // for provider failures. Prefer it over a machine code such as
    // STRIPE_CHECKOUT_UNAVAILABLE, while retaining a safe fallback.
    throw new Error(
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : data?.error || `IAP request failed (${res.status})`,
    );
  }
  return data as T;
}

export async function getPaymentStatus(providerTransactionId: string) {
  return apiJson<{ ok: boolean; status: string; payment?: { id: string; status: string; coinsGranted: number } }>(
    `/payments/status?providerTransactionId=${encodeURIComponent(providerTransactionId)}`,
  );
}

export async function getPaymentHistory() {
  return apiJson<{ items: Array<{
    id: string; productId: string; provider: string; status: string;
    coinsGranted: number; createdAt: string;
  }> }>("/payments/history?limit=50");
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
  if (!isKnownIapProduct(input.productId) && !['luma_vip_week', 'luma_vip_month', 'luma_vip_year'].includes(input.productId)) {
    throw new Error(`Unknown productId: ${input.productId}`);
  }
  const result = await apiJson<GoogleVerifyResponse>("/payments/google/verify", {
    method: "POST",
    body: JSON.stringify({
      productId: input.productId,
      purchaseToken: input.purchaseToken,
    }),
  });
  if (!result.ok || !('transaction' in result)) {
    if (result.pending) {
      throw new Error("Your Google Play payment is pending. Coins will be added after Google confirms it.");
    }
    throw new Error(result.message || result.error || "Google Play could not verify this purchase.");
  }
  return {
    ok: result.ok,
    balance: result.transaction.walletBalance,
    credited: result.transaction.coinsGranted,
    transactionId: result.transaction.id,
  };
}

/** Restore / re-query last Play purchase session after reinstall. */
export async function restorePurchases(userId?: string): Promise<{
  restored: boolean;
  balance?: number;
  message: string;
}> {
  const id = userId || getDeviceUserId();
  const nativeWindow = (
    window as unknown as {
      ZukoNativeIap?: {
        restore?: () => Promise<
          Array<{
            platform: IapPlatform;
            productId: string;
            purchaseToken: string;
          }>
        >;
        finish?: (purchaseToken: string) => Promise<void>;
      };
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
  );
  const nativeBridge = nativeWindow.ZukoNativeIap || nativeWindow.LumaNativeIap;

  if (nativeBridge?.restore) {
    try {
      const purchases = await nativeBridge.restore();
      let restoredCount = 0;
      let latestBalance: number | undefined;

      for (const purchase of purchases) {
        const product = getIapProduct(purchase.productId);
        const isVip = ["luma_vip_week", "luma_vip_month", "luma_vip_year"].includes(
          purchase.productId,
        );
        if ((!isKnownIapProduct(purchase.productId) && !isVip) || !purchase.purchaseToken) continue;
        const verified = await verifyIapPurchase({
          userId: id,
          productId: purchase.productId,
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
    const data = await apiJson<{ ok: boolean; results: PaymentApiTransaction[] }>("/payments/google/restore", {
      method: "POST",
      body: JSON.stringify({ purchases: [] }),
    });
    return {
      restored: data.results.length > 0,
      balance: data.results.at(-1)?.walletBalance,
      message: data.results.length > 0
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
  const requestId = getCheckoutRetryKey(input.userId, input.productId);
  return apiJson<{ checkoutUrl: string; paymentId: string }>("/payments/stripe/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": requestId },
    body: JSON.stringify({
      productId: input.productId,
    }),
  }).then((value) => ({ checkoutUrl: value.checkoutUrl, sessionId: value.paymentId }));
}

/**
 * Keeps one idempotency key while a browser retries the same product checkout
 * after a lost request/response. The backend additionally scopes it to the
 * authenticated account, so this browser-only value is never an authority.
 */
function getCheckoutRetryKey(userId: string, productId: string): string {
  const storageKey = `zuko_checkout_retry_v1:${userId}:${productId}`;
  const now = Date.now();
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as
      | { id?: string; createdAt?: number }
      | null;
    if (
      saved &&
      typeof saved.id === "string" &&
      /^[A-Za-z0-9_-]{16,128}$/.test(saved.id) &&
      typeof saved.createdAt === "number" &&
      now - saved.createdAt < 15 * 60_000
    ) return saved.id;
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${now.toString(36)}${Math.random().toString(36).slice(2, 18)}`;
    sessionStorage.setItem(storageKey, JSON.stringify({ id, createdAt: now }));
    return id;
  } catch {
    // Session storage can be disabled. Generate a retry key anyway; the
    // server still enforces token-authentication and entitlement idempotency.
    return `${now.toString(36)}${Math.random().toString(36).slice(2, 18)}`;
  }
}

/**
 * Production entry: prefer native bridge when injected on window by RN WebView.
 * Falls back to server checkout session for browser.
 */
export async function purchaseCoins(input: {
  userId: string;
  productId: string;
}): Promise<VerifyIapResult | { redirected: true; checkoutUrl: string }> {
  const userId = billingAccountId();

  const nativeWindow = window as unknown as {
    __ZUKO_ANDROID__?: number;
    ZukoNativeIap?: {
      isNativeGooglePlay?: boolean;
      purchase: (sku: string, type?: "in-app" | "subs", accountId?: string) => Promise<{
        platform: IapPlatform;
        productId?: string;
        purchaseToken: string;
      }>;
      finish?: (purchaseToken: string) => Promise<void>;
    };
    LumaNativeIap?: {
      isNativeGooglePlay?: boolean;
      purchase: (sku: string, type?: "in-app" | "subs", accountId?: string) => Promise<{
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
    if (product.webOnly) {
      throw new Error("This card package is available on the Zuko website only.");
    }
    const native = await bridge.purchase(product.platformSku.google, "in-app", userId);
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
    platform: "web",
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

export async function purchaseVip(productId: string): Promise<VerifyIapResult | { redirected: true; checkoutUrl: string }> {
  const nativeWindow = window as unknown as {
    __ZUKO_ANDROID__?: number;
    ZukoNativeIap?: {
      purchase: (sku: string, type?: "in-app" | "subs", accountId?: string) => Promise<{ platform: IapPlatform; purchaseToken: string }>;
      finish?: (purchaseToken: string) => Promise<void>;
    };
  };
  if (nativeWindow.ZukoNativeIap?.purchase) {
    const userId = billingAccountId();
    const purchase = await nativeWindow.ZukoNativeIap.purchase(productId, "subs", userId);
    const verified = await verifyIapPurchase({ userId, productId,
      platform: purchase.platform || "google", purchaseToken: purchase.purchaseToken });
    await nativeWindow.ZukoNativeIap.finish?.(purchase.purchaseToken);
    return verified;
  }
  if (nativeWindow.__ZUKO_ANDROID__) throw new Error("Google Play Billing is unavailable. External checkout is disabled in the Play build.");
  const session = await createIapCheckoutSession({ userId: billingAccountId(), productId, platform: "web" });
  window.location.href = session.checkoutUrl;
  return { redirected: true, checkoutUrl: session.checkoutUrl };
}
