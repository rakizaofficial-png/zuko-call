/**
 * Intelligent rotation for simulated incoming calls.
 * STRICT: only auto-generated premium female profiles.
 * Never mixes real male user IDs, placeholders, or low-quality avatars.
 */

import {
  DURATION_PREVIEWS,
  NOTIFICATION_TEMPLATES,
} from "./templates";
import type {
  WelcomePushHost,
  WelcomeRotationHistory,
} from "./types";
import { WELCOME_PUSH_CONFIG } from "./config";
import {
  generatedToWelcomeHost,
  isAutoCallEligibleProfile,
  pickGeneratedFemaleProfile,
  ensurePremiumFemalePool,
} from "./premiumFemaleGenerator";

const HISTORY_KEY = WELCOME_PUSH_CONFIG.storageKey;

function emptyHistory(): WelcomeRotationHistory {
  return {
    recentHostIds: [],
    recentMessageIds: [],
    recentAvatarSeeds: [],
    lastShownAt: 0,
    showCount: 0,
  };
}

export function readRotationHistory(): WelcomeRotationHistory {
  if (typeof window === "undefined") return emptyHistory();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw) as WelcomeRotationHistory;
    return {
      recentHostIds: parsed.recentHostIds || [],
      recentMessageIds: parsed.recentMessageIds || [],
      recentAvatarSeeds: parsed.recentAvatarSeeds || [],
      lastShownAt: Number(parsed.lastShownAt || 0),
      showCount: Number(parsed.showCount || 0),
    };
  } catch {
    return emptyHistory();
  }
}

function writeRotationHistory(h: WelcomeRotationHistory) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* ignore quota */
  }
}

function pushRecent(list: string[], id: string, max: number): string[] {
  const next = [id, ...list.filter((x) => x !== id)];
  return next.slice(0, max);
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickMessage(recentIds: string[]) {
  const cool = new Set(
    recentIds.slice(0, WELCOME_PUSH_CONFIG.messageCooldownCount),
  );
  const fresh = NOTIFICATION_TEMPLATES.filter((t) => !cool.has(t.id));
  const pool = fresh.length ? fresh : NOTIFICATION_TEMPLATES;
  return pickRandom(pool);
}

/**
 * Next simulated caller — premium auto-generated female only.
 * Live/API hosts are intentionally excluded to prevent male/low-quality mix-ins.
 */
export async function pickNextWelcomeCaller(): Promise<WelcomePushHost> {
  // Warm / refresh generated pool in background
  ensurePremiumFemalePool();

  const history = readRotationHistory();
  const message = pickMessage(history.recentMessageIds);
  let profile = pickGeneratedFemaleProfile(history.recentHostIds);

  // Hard gate — never emit ineligible identity
  let guard = 0;
  while (!isAutoCallEligibleProfile(profile) && guard < 8) {
    profile = pickGeneratedFemaleProfile([
      ...history.recentHostIds,
      profile.host_id,
    ]);
    guard += 1;
  }

  const chosen = generatedToWelcomeHost(
    profile,
    message,
    pickRandom(DURATION_PREVIEWS),
  );

  writeRotationHistory({
    recentHostIds: pushRecent(
      history.recentHostIds,
      chosen.host_id,
      WELCOME_PUSH_CONFIG.hostCooldownCount,
    ),
    recentMessageIds: pushRecent(
      history.recentMessageIds,
      chosen.messageId,
      WELCOME_PUSH_CONFIG.messageCooldownCount,
    ),
    recentAvatarSeeds: pushRecent(
      history.recentAvatarSeeds,
      chosen.avatar,
      WELCOME_PUSH_CONFIG.hostCooldownCount,
    ),
    lastShownAt: Date.now(),
    showCount: history.showCount + 1,
  });

  return chosen;
}

/** Randomized delay within [min, max] inclusive */
export function randomDelayMs(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function nextLaunchDelayMs(): number {
  return randomDelayMs(
    WELCOME_PUSH_CONFIG.launchDelayMinMs,
    WELCOME_PUSH_CONFIG.launchDelayMaxMs,
  );
}

export function nextRepeatDelayMs(): number {
  return randomDelayMs(
    WELCOME_PUSH_CONFIG.repeatEveryMinMs,
    WELCOME_PUSH_CONFIG.repeatEveryMaxMs,
  );
}

/** Delay until next autopush after recharge popup dismiss / expire */
export function nextPostRechargeDelayMs(): number {
  return randomDelayMs(
    WELCOME_PUSH_CONFIG.postRechargeDelayMinMs,
    WELCOME_PUSH_CONFIG.postRechargeDelayMaxMs,
  );
}

export function nextRingDurationMs(): number {
  return randomDelayMs(
    WELCOME_PUSH_CONFIG.ringDurationMinMs,
    WELCOME_PUSH_CONFIG.ringDurationMaxMs,
  );
}
