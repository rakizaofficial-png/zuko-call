/**
 * =============================================================================
 * IN-APP PURCHASE CATALOG — Google Play consumable coin products
 * =============================================================================
 * Play Console productIds must match exactly.
 */

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
  popular?: boolean;
  best?: boolean;
};

export const IAP_PRODUCTS: IapProduct[] = [
  {
    productId: "zuko_coins_90",
    platformSku: { google: "zuko_coins_90", apple: "zuko_coins_90" },
    coins: 90,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "90",
  },
  {
    productId: "zuko_coins_600",
    platformSku: { google: "zuko_coins_600", apple: "zuko_coins_600" },
    coins: 600,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "600",
    popular: true,
  },
  {
    productId: "zuko_coins_1300",
    platformSku: { google: "zuko_coins_1300", apple: "zuko_coins_1300" },
    coins: 1300,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "1,300",
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
  const bridge = (window as unknown as { ZukoNativeIap?: {
    products?: () => Promise<Array<{ productId: string; displayPrice: string }>>;
  } }).ZukoNativeIap;
  if (!bridge?.products) return IAP_PRODUCTS;
  const localized = await bridge.products();
  const prices = new Map(localized.map((item) => [item.productId, item.displayPrice]));
  return IAP_PRODUCTS.map((product) => ({
    ...product,
    priceLabel: prices.get(product.productId) || product.priceLabel,
  }));
}

export async function getNativeLocalizedPrices(): Promise<Map<string, string>> {
  if (typeof window === "undefined") return new Map();
  const bridge = (window as unknown as { ZukoNativeIap?: {
    products?: () => Promise<Array<{ productId: string; displayPrice: string }>>;
  } }).ZukoNativeIap;
  if (!bridge?.products) return new Map();
  return new Map((await bridge.products()).map((item) => [item.productId, item.displayPrice]));
}
