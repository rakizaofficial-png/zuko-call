/**
 * =============================================================================
 * IN-APP PURCHASE CATALOG — TikTok-style coin ladder (Google Play / Apple)
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
    productId: "luma_coins_50",
    platformSku: { google: "luma_coins_50", apple: "luma_coins_50" },
    coins: 50,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "50",
  },
  {
    productId: "luma_coins_100",
    platformSku: { google: "luma_coins_100", apple: "luma_coins_100" },
    coins: 100,
    bonusCoins: 0,
    priceLabel: "Store price",
    title: "100",
  },
  {
    productId: "luma_coins_250",
    platformSku: { google: "luma_coins_250", apple: "luma_coins_250" },
    coins: 250,
    bonusCoins: 10,
    priceLabel: "Store price",
    title: "250",
  },
  {
    productId: "luma_coins_500",
    platformSku: { google: "luma_coins_500", apple: "luma_coins_500" },
    coins: 500,
    bonusCoins: 50,
    priceLabel: "Store price",
    title: "500",
  },
  {
    productId: "luma_coins_1000",
    platformSku: { google: "luma_coins_1000", apple: "luma_coins_1000" },
    coins: 1000,
    bonusCoins: 120,
    priceLabel: "Store price",
    title: "1,000",
    popular: true,
  },
  {
    productId: "luma_coins_2000",
    platformSku: { google: "luma_coins_2000", apple: "luma_coins_2000" },
    coins: 2000,
    bonusCoins: 350,
    priceLabel: "Store price",
    title: "2,000",
  },
  {
    productId: "luma_coins_5000",
    platformSku: { google: "luma_coins_5000", apple: "luma_coins_5000" },
    coins: 5000,
    bonusCoins: 1000,
    priceLabel: "Store price",
    title: "5,000",
    best: true,
  },
  {
    productId: "luma_coins_10000",
    platformSku: { google: "luma_coins_10000", apple: "luma_coins_10000" },
    coins: 10000,
    bonusCoins: 2500,
    priceLabel: "Store price",
    title: "10,000",
  },
];

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
