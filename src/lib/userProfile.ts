/**
 * Local user profile — created automatically on first app open.
 * Same device ID is used for wallet, IAP purchases, and calls.
 */

import { apiConfig } from "@/config/apiConfig";

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  createdAt: number;
  isNew: boolean;
  appId?: string;
};

const PROFILE_KEY = "luma_user_profile_v1";

const AVATARS = [
  "https://api.dicebear.com/9.x/thumbs/svg?seed=",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=",
];

function shortNameFromId(userId: string): string {
  const tail = userId.replace(/^luma_/, "").slice(0, 4).toUpperCase();
  return `Luma ${tail || "Fan"}`;
}

function readRaw(): Omit<UserProfile, "isNew"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<UserProfile, "isNew">;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(profile: Omit<UserProfile, "isNew">) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Stable device user id (also mirrored in apiConfig.deviceUserKey) */
export function ensureDeviceUserId(): string {
  if (typeof window === "undefined") return "server";
  const key = apiConfig.deviceUserKey;
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `luma_${crypto.randomUUID()}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `luma_${Date.now()}`;
  }
}

/**
 * Create or load local profile. Call once on app boot.
 * Returns `isNew: true` the first time this device gets a profile.
 */
export function ensureLocalProfile(): UserProfile {
  const userId = ensureDeviceUserId();
  const existing = readRaw();

  if (existing && existing.userId === userId) {
    return { ...existing, isNew: false };
  }

  const displayName = existing?.displayName || shortNameFromId(userId);
  const avatarUrl =
    existing?.avatarUrl ||
    `${AVATARS[0]}${encodeURIComponent(userId)}`;
  const createdAt = existing?.createdAt || Date.now();
  const profile = { userId, displayName, avatarUrl, createdAt };
  writeRaw(profile);
  return { ...profile, isNew: !existing };
}

export function getLocalProfile(): UserProfile {
  return ensureLocalProfile();
}

export function updateLocalDisplayName(displayName: string): UserProfile {
  const current = ensureLocalProfile();
  const next = {
    ...current,
    displayName: displayName.trim() || current.displayName,
  };
  writeRaw({
    userId: next.userId,
    displayName: next.displayName,
    avatarUrl: next.avatarUrl,
    createdAt: next.createdAt,
  });
  return { ...next, isNew: false };
}

export function shortUserId(userId: string): string {
  if (!userId) return "—";
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}
