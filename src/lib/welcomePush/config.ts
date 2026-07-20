/**
 * Welcome Push Call Engine — conversion funnel configuration.
 * Demo hosts are used only when no real female hosts are online.
 */

import type { WelcomePaywallTier, WelcomePushHost } from "./types";

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
  name: "Mira",
  age: 23,
  avatar:
    "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=900&h=1400&fit=crop&q=85",
  ring_video_url: "https://assets.mixkit.co/videos/1215/1215-720.mp4",
  teaser_video_url:
    process.env.NEXT_PUBLIC_WELCOME_TEASER_URL ||
    "https://assets.mixkit.co/videos/1215/1215-720.mp4",
  country: "Korea",
  flag: "🇰🇷",
  language: "Korean · English",
  bio: "Just got free — private video?",
  interests: ["Fashion", "Travel"],
  level: 12,
  isVip: true,
  isVerified: true,
  isOnline: true,
  durationPreview: "a few minutes",
  message: "Hi, I'm online now.",
  messageId: "m01",
  source: "demo",
  mediaPackId: "bikini_beach_01",
};

export function buildPaywallTiers(hostName: string): WelcomePaywallTier[] {
  return [
    {
      id: "unlock_5",
      headline: "Keep talking to her",
      sub: `${hostName} is still on the line · unlock 5 mins`,
      coins: 50,
      price: "$1.00",
      neon: "green",
    },
    {
      id: "popular_50",
      headline: "Most chosen · 50 Coins",
      sub: `Jump back to ${hostName} before she leaves`,
      coins: 50,
      price: "$0.99",
      neon: "pink",
      popular: true,
    },
    {
      id: "boost_300",
      headline: "Stay longer · 300 Coins",
      sub: "Private VIP minutes · she won’t wait forever",
      coins: 300,
      price: "$4.99",
      neon: "gold",
    },
  ];
}

/** Static fallback tiers (prefer buildPaywallTiers) */
export const WELCOME_PAYWALL_TIERS = buildPaywallTiers("her");

export const WELCOME_PUSH_CONFIG = {
  /**
   * First lure after home / dashboard browsing.
   * Short window so auto-calls feel active while browsing.
   */
  launchDelayMinMs: 12_000,
  launchDelayMaxMs: 28_000,
  /** Recurring lure while browsing */
  repeatEveryMinMs: 45_000,
  repeatEveryMaxMs: 90_000,
  /** Incoming modal + ringtone auto-end */
  ringDurationMinMs: 22_000,
  ringDurationMaxMs: 35_000,
  /** Teaser hard-cut → recharge paywall (when user has coins) — 30s mobile fake call */
  teaserCutMs: 30_000,
  /** Paywall FOMO countdown */
  offerSeconds: 45,
  /** Don't reuse these many recent hosts / messages */
  hostCooldownCount: 10,
  messageCooldownCount: 14,
  /** Bump when media / timing rules change */
  storageKey: "luma_welcome_push_v7",
} as const;
