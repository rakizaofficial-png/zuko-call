/**
 * ============================================================================
 * NATIVE IN-APP PURCHASE HOOKS (GOOGLE PLAY + APPLE)
 * ============================================================================
 *
 * SETUP — GOOGLE PLAY BILLING
 * 1. Play Console → Your app → Monetize with Play → Products → In-app products
 * 2. Create products with IDs matching `GOOGLE_SKUS` below (e.g. luma_coins_50)
 * 3. Link a license tester account for QA
 * 4. On Android build, install `react-native-iap` or Capacitor Purchases plugin
 *    and call `purchasePack(sku)` from the wallet UI
 * 5. ALWAYS send purchaseToken to POST /api/wallet/iap/verify on your API
 *
 * SETUP — APPLE IN-APP PURCHASE
 * 1. App Store Connect → Features → In-App Purchases → Consumable
 * 2. Create products with IDs matching `APPLE_SKUS`
 * 3. Use StoreKit 2 / react-native-iap; send signed transaction JWS to
 *    POST /api/wallet/iap/verify with platform=apple
 *
 * This module is the production wrapper. On web it opens the API checkout
 * session; on native shells you swap `nativePurchase` with the real SDK call.
 * ============================================================================
 */

import { env } from "@/config/env";
import {
  fetchCoinPacks,
  getSessionToken,
  verifyIapReceipt,
  type CoinPackDto,
} from "@/services/walletApi";

export const GOOGLE_SKUS = {
  unlock_5: "luma_coins_50",
  popular_50: "luma_coins_50",
  boost_300: "luma_coins_300",
  pack_500: "luma_coins_500",
  pack_1200: "luma_coins_1200",
  pack_2500: "luma_coins_2500",
} as const;

export const APPLE_SKUS = { ...GOOGLE_SKUS } as const;

export type PurchaseResult =
  | { ok: true; walletCoins: number }
  | { ok: false; error: string };

/**
 * Production purchase entry — routes to native IAP when available,
 * otherwise requests a server-side Play Billing / App Store session.
 */
export async function purchaseCoinPack(
  pack: CoinPackDto,
): Promise<PurchaseResult> {
  const token = getSessionToken();
  const platform = detectPlatform();

  try {
    // Native bridge (Capacitor / RN / Cordova) — implement when shipping stores
    const native = await tryNativePurchase(pack, platform);
    if (native) {
      const wallet = await verifyIapReceipt({
        platform: platform === "ios" ? "apple" : "google",
        productId:
          platform === "ios"
            ? pack.platformProductId.apple
            : pack.platformProductId.google,
        purchaseToken: native.purchaseToken,
        receiptData: native.receiptData,
        token,
      });
      return { ok: true, walletCoins: wallet.coins };
    }

    // Web / fallback: ask API to create a Play Billing One-Time Product flow
    // or Stripe PaymentIntent if you enable Stripe later.
    const res = await fetch(`${env.apiBaseUrl}/wallet/iap/begin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        packId: pack.id,
        sku: pack.sku,
        platform,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Checkout failed" };
    }

    if (data.checkoutUrl && typeof window !== "undefined") {
      window.location.href = data.checkoutUrl as string;
      return { ok: true, walletCoins: -1 };
    }

    // Dev/staging: server may credit after simulated verify
    if (data.wallet?.coins != null) {
      return { ok: true, walletCoins: data.wallet.coins as number };
    }

    return {
      ok: false,
      error:
        "IAP not configured — set Play/App Store products and wire nativePurchase",
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Purchase failed",
    };
  }
}

export async function loadStorePacks(): Promise<CoinPackDto[]> {
  return fetchCoinPacks(getSessionToken());
}

function detectPlatform(): "android" | "ios" | "web" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "web";
}

/**
 * Hook point for react-native-iap / Capacitor InAppPurchases.
 * Return null on web so the HTTP checkout path runs.
 */
async function tryNativePurchase(
  _pack: CoinPackDto,
  platform: "android" | "ios" | "web",
): Promise<{ purchaseToken: string; receiptData?: string } | null> {
  if (platform === "web") return null;
  // TODO(native):
  // import * as RNIap from 'react-native-iap'
  // const purchase = await RNIap.requestPurchase({ sku: pack.platformProductId.google })
  // return { purchaseToken: purchase.purchaseToken, receiptData: purchase.transactionReceipt }
  return null;
}
