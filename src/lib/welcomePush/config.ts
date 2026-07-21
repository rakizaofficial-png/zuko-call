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
   * First lure after 1–2 minutes of browsing when wallet is empty.
   */
  launchDelayMinMs: 60_000,
  launchDelayMaxMs: 120_000,
  /** Recurring lure while browsing broke (1–2 min between rings) */
  repeatEveryMinMs: 60_000,
  repeatEveryMaxMs: 120_000,
  /**
   * After recharge paywall dismiss / "Recharge later" — next autopush in 1–2 min.
   */
  postRechargeDelayMinMs: 60_000,
  postRechargeDelayMaxMs: 120_000,
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
  storageKey: "luma_welcome_push_v13_1to2m_recharge_later",
} as const;
