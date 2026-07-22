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
    priceLabel: "$0.99",
    title: "50",
  },
  {
    productId: "luma_coins_100",
    platformSku: { google: "luma_coins_100", apple: "luma_coins_100" },
    coins: 100,
    bonusCoins: 0,
    priceLabel: "$1.99",
    title: "100",
  },
  {
    productId: "luma_coins_250",
    platformSku: { google: "luma_coins_250", apple: "luma_coins_250" },
    coins: 250,
    bonusCoins: 10,
    priceLabel: "$2.99",
    title: "250",
  },
  {
    productId: "luma_coins_500",
    platformSku: { google: "luma_coins_500", apple: "luma_coins_500" },
    coins: 500,
    bonusCoins: 50,
    priceLabel: "$4.99",
    title: "500",
  },
  {
    productId: "luma_coins_1000",
    platformSku: { google: "luma_coins_1000", apple: "luma_coins_1000" },
    coins: 1000,
    bonusCoins: 120,
    priceLabel: "$9.99",
    title: "1,000",
    popular: true,
  },
  {
    productId: "luma_coins_2000",
    platformSku: { google: "luma_coins_2000", apple: "luma_coins_2000" },
    coins: 2000,
    bonusCoins: 350,
    priceLabel: "$19.99",
    title: "2,000",
  },
  {
    productId: "luma_coins_5000",
    platformSku: { google: "luma_coins_5000", apple: "luma_coins_5000" },
    coins: 5000,
    bonusCoins: 1000,
    priceLabel: "$49.99",
    title: "5,000",
    best: true,
  },
  {
    productId: "luma_coins_10000",
    platformSku: { google: "luma_coins_10000", apple: "luma_coins_10000" },
    coins: 10000,
    bonusCoins: 2500,
    priceLabel: "$99.99",
    title: "10,000",
  },
];

export function getIapProduct(productId: string) {
  return IAP_PRODUCTS.find((p) => p.productId === productId) ?? null;
}
