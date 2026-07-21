import type { Achievement, Mission, SpinPrize } from "./types";

/** Flat daily login — amount is enforced server-side */
export const DAILY_CHECKIN_REWARDS = [20] as const;
export const DAILY_LOGIN_COINS = 20;

export const SPIN_COST = 0;
/** Strict daily limit — one spin per day. */
export const MAX_SPINS_PER_DAY = 1;
/**
 * Hard lifetime cap on coins won from the Lucky Spin. Once a user's cumulative
 * spin winnings reach this, spinning is blocked so the feature can never drain
 * excess coins / hand out unlimited payouts. With 30–35 per spin this keeps the
 * overall spin winnings in the ~60–70 range.
 */
export const SPIN_TOTAL_COIN_CAP = 70;

/** UI segments only — actual payout is random 30–35 from server */
export const SPIN_PRIZES: SpinPrize[] = [
  { id: "c30", label: "30", coins: 30, weight: 20, color: "#3d8bfd" },
  { id: "c31", label: "31", coins: 31, weight: 18, color: "#00c9a7" },
  { id: "c32", label: "32", coins: 32, weight: 18, color: "#ffb800" },
  { id: "c33", label: "33", coins: 33, weight: 16, color: "#ff6b4a" },
  { id: "c34", label: "34", coins: 34, weight: 14, color: "#ff2a7a" },
  { id: "c35", label: "35", coins: 35, weight: 14, color: "#c44dff" },
];

export const WEEKLY_MISSIONS: Mission[] = [
  { id: "open_app", title: "Open Luma today", reward: 0, xp: 15, icon: "☀️", target: 1 },
  { id: "watch_live", title: "Watch a live for 2 min", reward: 0, xp: 25, icon: "📺", target: 1 },
  { id: "send_gift", title: "Send a gift", reward: 0, xp: 40, icon: "🎁", target: 1 },
  { id: "start_call", title: "Start a 1v1 call", reward: 0, xp: 50, icon: "📞", target: 1 },
  { id: "follow_host", title: "Follow a host", reward: 0, xp: 20, icon: "❤️", target: 1 },
  { id: "spin_once", title: "Spin the Lucky Wheel", reward: 0, xp: 15, icon: "🎰", target: 1 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_call", title: "First Connection", desc: "Complete your first call", reward: 0, icon: "📞" },
  { id: "streak_3", title: "On Fire", desc: "3-day check-in streak", reward: 0, icon: "🔥" },
  { id: "streak_7", title: "Week Warrior", desc: "7-day check-in streak", reward: 0, icon: "⚡" },
  { id: "first_gift", title: "Generous Soul", desc: "Send your first gift", reward: 0, icon: "🎁" },
  { id: "level_5", title: "Rising Star", desc: "Reach level 5", reward: 0, icon: "⭐" },
  { id: "vip_join", title: "VIP Circle", desc: "Activate a VIP plan", reward: 0, icon: "👑" },
  { id: "spin_win", title: "Lucky Charm", desc: "Win coins on spin", reward: 0, icon: "🍀" },
  { id: "referral_1", title: "Ambassador", desc: "Refer a friend", reward: 0, icon: "🤝" },
];

export const XP_PER_LEVEL = 200;
export const FREE_TRIAL_SECONDS = 30;
/** Client display only — real referral coins come from POST /rewards/referral */
export const REFERRAL_REWARD = 0;
export const WELCOME_BONUS_COINS = 60;

export const HOST_CATEGORIES = [
  "All",
  "Trending",
  "New",
  "Top Rated",
  "Nearby",
  "Music",
  "Chill",
  "Party",
  "Language",
] as const;

export type HostCategory = (typeof HOST_CATEGORIES)[number];
