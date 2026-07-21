/**
 * Premium live lock — host locks the stream; viewers unlock with a gift.
 * Unlock state is persisted per viewer + room for the browser session.
 */

import { gifts, type Gift } from "@/lib/data";

const STORAGE_PREFIX = "zuko_live_unlock_v1:";

export const DEFAULT_UNLOCK_COINS = 199; // Crown and above

export function unlockStorageKey(roomId: string, userId: string) {
  return `${STORAGE_PREFIX}${roomId}:${userId || "guest"}`;
}

export function hasUnlockedLive(roomId: string, userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(unlockStorageKey(roomId, userId)) === "1";
  } catch {
    return false;
  }
}

export function markLiveUnlocked(roomId: string, userId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(unlockStorageKey(roomId, userId), "1");
  } catch {
    /* ignore quota */
  }
}

/** Cheapest gift that meets the unlock coin requirement */
export function pickUnlockGift(minCoins = DEFAULT_UNLOCK_COINS): Gift {
  const sorted = [...gifts].sort((a, b) => a.coins - b.coins);
  return sorted.find((g) => g.coins >= minCoins) || sorted[sorted.length - 1]!;
}

export function giftMeetsUnlock(giftCoins: number, minCoins = DEFAULT_UNLOCK_COINS) {
  return giftCoins >= minCoins;
}

/** Parse lock flags from various API shapes */
export function parseRoomLocked(raw: Record<string, unknown>): {
  locked: boolean;
  unlockCoins: number;
  unlockGiftId?: string;
} {
  const locked = Boolean(
    raw.isLocked ||
      raw.locked ||
      raw.isPremium ||
      raw.premium ||
      raw.premiumLive ||
      raw.mode === "premium" ||
      raw.mode === "locked",
  );
  const unlockCoins = Math.max(
    1,
    Number(raw.unlockCoins ?? raw.lockPrice ?? raw.premiumPrice ?? DEFAULT_UNLOCK_COINS) ||
      DEFAULT_UNLOCK_COINS,
  );
  const unlockGiftId = raw.unlockGiftId
    ? String(raw.unlockGiftId)
    : undefined;
  return { locked, unlockCoins, unlockGiftId };
}
