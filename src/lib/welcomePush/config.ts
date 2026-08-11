/**
 * Welcome Push Call Engine — conversion funnel configuration.
 * Demo hosts are used only when no real female hosts are online.
 */

import type { WelcomePaywallTier, WelcomePushHost } from "./types";
import { IAP_PRODUCTS } from "@/lib/payments/iapCatalog";

export type {
  WelcomePushPhase,
  WelcomePushHost,
  WelcomePaywallTier,
  WelcomeHostSource,
  WelcomeRotationHistory,
} from "./types";

/** @deprecated Prefer pickNextWelcomeCaller() — kept for type-compat imports */
export const WELCOME_PUSH_HOST: WelcomePushHost = {
  host_id: "sim_f_boot",
  name: "Yuna",
  age: 22,
  avatar: "https://luma-user.onrender.com/hosts/asian/01.png",
  ring_video_url:
    "https://videos.pexels.com/video-files/2499611/2499611-hd_720_1280_30fps.mp4",
  teaser_video_url:
    process.env.NEXT_PUBLIC_WELCOME_TEASER_URL ||
    "https://videos.pexels.com/video-files/6010878/6010878-hd_720_1280_30fps.mp4",
  country: "Korea",
  flag: "🇰🇷",
  language: "Korean · English",
  bio: "Just got free — private video?",
  interests: ["Fashion", "Travel"],
  level: 12,
  isVip: true,
  isVerified: true,
  isOnline: true,
  durationPreview: "30 sec free",
  message: "Hi, I'm online now.",
  messageId: "m01",
  source: "demo",
  mediaPackId: "asia_dp_01",
};

export function buildPaywallTiers(hostName: string): WelcomePaywallTier[] {
  const copy = [
    {
      headline: "Keep talking",
      sub: `${hostName} is still on the line`,
      neon: "green" as const,
    },
    {
      headline: "Most chosen",
      sub: `Jump back to ${hostName} before she leaves`,
      neon: "pink" as const,
    },
    {
      headline: "Stay longer",
      sub: "More coins for private calls and gifts",
      neon: "gold" as const,
    },
  ];

  // Keep the conversion sheet aligned with the only coin products offered by
  // the current Play/Stripe catalog. Provider dashboards remain authoritative
  // for price; `priceLabel` is replaced with Google Play's localized value in
  // the native shell when available.
  // This sheet may be shown inside the Android Play build. Web-only card
  // packages belong in the web recharge sheet, not in this Play checkout UI.
  return IAP_PRODUCTS.filter((product) => !product.webOnly).map((product, index) => ({
    id: product.productId,
    headline: `${copy[index]!.headline} · ${product.coins.toLocaleString()} Coins`,
    sub: copy[index]!.sub,
    coins: product.coins + product.bonusCoins,
    price: product.priceLabel,
    neon: copy[index]!.neon,
    popular: product.popular,
  }));
}

/** Static fallback tiers (prefer buildPaywallTiers) */
export const WELCOME_PAYWALL_TIERS = buildPaywallTiers("her");

export const WELCOME_PUSH_CONFIG = {
  /**
   * First lure after 1–2 minutes when wallet is low / empty.
   */
  launchDelayMinMs: 7_000,
  launchDelayMaxMs: 7_000,
  /** Recurring lure while browsing low-coin (1–2 min between rings) */
  repeatEveryMinMs: 60_000,
  repeatEveryMaxMs: 60_000,
  /**
   * After recharge paywall dismiss / "Recharge later" — next autopush in 1–2 min.
   */
  postRechargeDelayMinMs: 60_000,
  postRechargeDelayMaxMs: 60_000,
  /**
   * Autopush when coins are at or below this (low balance), not only zero.
   * Matches ~1 minute call rate so broke/near-broke users get lured.
   */
  lowCoinThreshold: 80,
  /** Incoming modal + ringtone auto-end */
  ringDurationMinMs: 22_000,
  ringDurationMaxMs: 35_000,
  /** Fallback only when the preview clip has no duration (photo / load fail) */
  teaserCutMs: 30_000,
  /** Absolute max preview if metadata never arrives */
  teaserMaxMs: 120_000,
  /** Paywall wait — if no recharge, call cuts */
  offerSeconds: 20,
  /** Don't reuse these many recent hosts / messages */
  hostCooldownCount: 10,
  messageCooldownCount: 14,
  /** Bump when media / timing rules change */
  storageKey: "luma_welcome_push_v15_interval_preview",
} as const;
