/**
 * =============================================================================
 * PURCHASE CATALOG — Google Play consumables plus web-only Stripe packages
 * =============================================================================
 * Play Console productIds must match exactly. Web-only products never enter
 * the Android Google Play Billing flow.
 */

import { requireApiBase } from "@/config/apiConfig";

export type IapProduct = {
  productId: string;
  platformSku: {
    google: string;
    apple: string;
  };
  coins: number;
  bonusCoins: number;
  priceLabel: string;
  title: string;
  /** Value bonus compared with the 99-coin US$1 starter rate. */
  valueLabel?: string;
  popular?: boolean;
  best?: boolean;
  /** False means the server has not enabled this provider package yet. */
  available?: boolean;
  /** Must not be passed to the native Google Play Billing bridge. */
  webOnly?: boolean;
};

export const IAP_PRODUCTS: IapProduct[] = [
  {
    productId: "zuko_coins_99",
    platformSku: { google: "zuko_coins_99", apple: "zuko_coins_99" },
    coins: 99,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "99",
  },
  {
    productId: "zuko_coins_600",
    platformSku: { google: "zuko_coins_600", apple: "zuko_coins_600" },
    coins: 495,
    bonusCoins: 105,
    priceLabel: "Store price",
    title: "600",
    valueLabel: "+105 bonus",
    popular: true,
  },
  {
    productId: "zuko_coins_1300",
    platformSku: { google: "zuko_coins_1300", apple: "zuko_coins_1300" },
    coins: 990,
    bonusCoins: 310,
    priceLabel: "Store price",
    title: "1,300",
    valueLabel: "+310 bigger bonus",
  },
  {
    productId: "zuko_coins_3000",
    platformSku: { google: "zuko_coins_3000", apple: "zuko_coins_3000" },
    coins: 1980,
    bonusCoins: 1020,
    priceLabel: "Store price",
    title: "3,000",
    valueLabel: "+1,020 extra bonus",
  },
  {
    productId: "zuko_coins_8500",
    platformSku: { google: "zuko_coins_8500", apple: "zuko_coins_8500" },
    coins: 4950,
    bonusCoins: 3550,
    priceLabel: "Store price",
    title: "8,500",
    valueLabel: "+3,550 premium bonus",
    popular: true,
  },
  {
    productId: "zuko_coins_20000",
    platformSku: { google: "zuko_coins_20000", apple: "zuko_coins_20000" },
    coins: 9900,
    bonusCoins: 10100,
    priceLabel: "Store price",
    title: "20,000",
    valueLabel: "+10,100 best value bonus",
    best: true,
  },
];

/** Historical products stay recognizable for verified restoration only. */
export const LEGACY_IAP_PRODUCT_IDS = new Set([
  "luma_coins_50", "luma_coins_100", "luma_coins_250", "luma_coins_500",
  "luma_coins_1000", "luma_coins_2000", "luma_coins_5000", "luma_coins_10000",
]);

export function isKnownIapProduct(productId: string) {
  return Boolean(getIapProduct(productId)) || LEGACY_IAP_PRODUCT_IDS.has(productId);
}

export function getIapProduct(productId: string) {
  return IAP_PRODUCTS.find((p) => p.productId === productId) ?? null;
}

export async function getLocalizedIapProducts(): Promise<IapProduct[]> {
  if (typeof window === "undefined") return IAP_PRODUCTS;
  const nativeWindow = window as unknown as {
    __ZUKO_ANDROID__?: number;
    ZukoNativeIap?: {
    products?: () => Promise<Array<{ productId: string; displayPrice: string }>>;
    };
  };
  const bridge = nativeWindow.ZukoNativeIap;
  if (bridge?.products) {
    const localized = await bridge.products();
    const prices = new Map(localized.map((item) => [item.productId, item.displayPrice]));
    return IAP_PRODUCTS.filter((product) => !product.webOnly).map((product) => ({
      ...product,
      priceLabel: prices.get(product.productId) || product.priceLabel,
      available: true,
    }));
  }
  if (nativeWindow.__ZUKO_ANDROID__) return IAP_PRODUCTS.filter((product) => !product.webOnly);

  try {
    const response = await fetch(`${requireApiBase()}/payments/catalog?platform=web`, { cache: "no-store" });
    const payload = await response.json() as {
      products?: Array<{
        id: string; type: string; coins: number; bonusCoins: number;
        title: string; available: boolean; price?: string | null;
      }>;
    };
    if (!response.ok || !Array.isArray(payload.products)) throw new Error("Web payment catalog unavailable");
    return payload.products
      .filter((product) => product.type === "coins")
      .map((product) => {
        const known = getIapProduct(product.id);
        return {
          productId: product.id,
          platformSku: known?.platformSku || { google: "", apple: "" },
          coins: product.coins,
          bonusCoins: product.bonusCoins,
          title: known?.title || product.title.replace(/\s*Coins$/i, ""),
          popular: known?.popular,
          best: known?.best,
          webOnly: Boolean(known?.webOnly),
          available: product.available,
          // This comes only from the provider-backed API once configured. A
          // browser never receives a Stripe Price ID or an authoritative amount.
          priceLabel: product.price || (product.available ? "Card checkout" : "Card checkout unavailable"),
          valueLabel: known?.valueLabel,
        };
      });
  } catch {
    return IAP_PRODUCTS.map((product) => ({
      ...product,
      available: false,
      priceLabel: "Card checkout unavailable",
    }));
  }
}

export async function getNativeLocalizedPrices(): Promise<Map<string, string>> {
  if (typeof window === "undefined") return new Map();
  const bridge = (window as unknown as { ZukoNativeIap?: {
    products?: () => Promise<Array<{ productId: string; displayPrice: string }>>;
  } }).ZukoNativeIap;
  if (!bridge?.products) return new Map();
  return new Map((await bridge.products()).map((item) => [item.productId, item.displayPrice]));
}
