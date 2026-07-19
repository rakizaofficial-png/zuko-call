/**
 * Auto-generates diverse premium female host identities for simulated calls.
 * NEVER uses real male user IDs, placeholders, or low-quality face crops.
 * Avatar + ring video always come from the same premium media pack.
 */

import { isFemaleHostProfile } from "@/lib/femaleHosts";
import {
  pickPremiumCallMedia,
  pickRandomPremiumCallMedia,
  PREMIUM_FULLBODY_AVATARS,
  type PremiumCallMediaPack,
} from "./premiumCallMedia";
import type { WelcomePushHost } from "./types";

const POOL_KEY = "luma_sim_female_pool_v2";
const POOL_SIZE = 36;

/** @deprecated Prefer pack.teaserVideo — kept for external CDN override */
export const PREMIUM_TEASER_URL =
  process.env.NEXT_PUBLIC_WELCOME_TEASER_URL ||
  pickPremiumCallMedia(0).teaserVideo;

/** Full-body glamorous stills only — no tight face crops */
export const SAFE_PREMIUM_FEMALE_AVATARS = PREMIUM_FULLBODY_AVATARS;
export const PREMIUM_FEMALE_AVATARS = SAFE_PREMIUM_FEMALE_AVATARS;

const FIRST_NAMES = [
  "Mira", "Sofia", "Aya", "Lina", "Elena", "Noor", "Zara", "Hana", "Priya",
  "Amira", "Yuna", "Luna", "Maya", "Sara", "Nina", "Isla", "Aria", "Leia",
  "Ruby", "Valentina", "Chloe", "Mei", "Fatima", "Aisha", "Layla", "Nadia",
  "Sienna", "Nova", "Camila", "Kiara", "Ananya", "Yasmine", "Bianca", "Rina",
  "Daria", "Selena",
] as const;

const LAST_NAMES = [
  "Rose", "Glow", "Moon", "Sweet", "Vibe", "Bloom", "Lux", "Sky", "Belle",
  "Nova", "Kiss", "Star", "Jade", "Pearl", "Flame",
] as const;

const LOCALES: { country: string; flag: string; language: string }[] = [
  { country: "Korea", flag: "🇰🇷", language: "Korean · English" },
  { country: "Brazil", flag: "🇧🇷", language: "Portuguese · English" },
  { country: "Japan", flag: "🇯🇵", language: "Japanese · English" },
  { country: "Turkey", flag: "🇹🇷", language: "Turkish · English" },
  { country: "Spain", flag: "🇪🇸", language: "Spanish · English" },
  { country: "UAE", flag: "🇦🇪", language: "Arabic · English" },
  { country: "India", flag: "🇮🇳", language: "Hindi · English" },
  { country: "Thailand", flag: "🇹🇭", language: "Thai · English" },
  { country: "Mexico", flag: "🇲🇽", language: "Spanish · English" },
  { country: "France", flag: "🇫🇷", language: "French · English" },
  { country: "Italy", flag: "🇮🇹", language: "Italian · English" },
  { country: "Colombia", flag: "🇨🇴", language: "Spanish · English" },
  { country: "Philippines", flag: "🇵🇭", language: "Tagalog · English" },
  { country: "USA", flag: "🇺🇸", language: "English" },
  { country: "UK", flag: "🇬🇧", language: "English" },
  { country: "Indonesia", flag: "🇮🇩", language: "Indonesian · English" },
];

const BIOS = [
  "Just got free — private video?",
  "Glam night mood · miss talking",
  "Beach energy · soft voice",
  "VIP host · waiting for you",
  "Feeling cute · answer me?",
  "Late-night private chat open",
  "Premium line · only a few calls",
  "Warm laughs · come closer",
  "Bikini day · answer before I leave",
  "Poolside & free for a private call",
];

const INTERESTS = [
  ["Fashion", "Travel"],
  ["Dance", "Beach"],
  ["Music", "Nightlife"],
  ["Fitness", "Selfie"],
  ["Luxury", "Chat"],
  ["Beauty", "ASMR"],
  ["Bikini", "Summer"],
  ["Pool", "Glam"],
];

const BLOCKED_IDS = new Set([
  "me",
  "host",
  "user",
  "admin",
  "demo",
  "placeholder",
  "luna beauty",
  "luma fan",
]);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 10);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export type GeneratedFemaleProfile = {
  host_id: string;
  name: string;
  age: number;
  avatar: string;
  ringVideo: string;
  teaserVideo: string;
  mediaPackId: string;
  country: string;
  flag: string;
  language: string;
  bio: string;
  interests: string[];
  level: number;
  isVip: boolean;
  isVerified: boolean;
  gender: "female";
  quality: "premium";
  createdAt: number;
};

/** Reject male / placeholder / low-quality identities */
export function isAutoCallEligibleProfile(input: {
  id?: string;
  name?: string;
  gender?: string;
  avatar?: string;
}): boolean {
  const id = String(input.id || "").toLowerCase();
  const name = String(input.name || "").trim();
  if (!name || BLOCKED_IDS.has(name.toLowerCase())) return false;
  if (BLOCKED_IDS.has(id) || id === "me" || id.startsWith("luma_")) return false;
  if (!isFemaleHostProfile({ name, gender: input.gender || "female" })) {
    return false;
  }
  const gender = String(input.gender || "").toLowerCase();
  if (gender === "male" || gender === "m") return false;
  const avatar = String(input.avatar || "");
  if (!avatar || avatar.includes("dicebear") || avatar.includes("placeholder")) {
    return false;
  }
  // Block pravatar & random face crops
  if (avatar.includes("i.pravatar.cc")) return false;
  if (avatar.includes("randomuser.me")) return false;
  return true;
}

export function generatePremiumFemaleProfile(
  index = 0,
  avoidPackIds: string[] = [],
): GeneratedFemaleProfile {
  const locale = LOCALES[index % LOCALES.length]!;
  const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const useLast = Math.random() < 0.55;
  const name = useLast ? `${first} ${pick(LAST_NAMES)}` : first;
  const media: PremiumCallMediaPack =
    avoidPackIds.length > 0
      ? pickRandomPremiumCallMedia(avoidPackIds)
      : pickPremiumCallMedia(index);

  const profile: GeneratedFemaleProfile = {
    host_id: `sim_f_${uid()}`,
    name,
    age: 21 + (index % 8),
    avatar: media.avatar,
    ringVideo: media.ringVideo,
    teaserVideo: media.teaserVideo,
    mediaPackId: media.id,
    country: locale.country,
    flag: locale.flag,
    language: locale.language,
    bio: pick(BIOS),
    interests: [...pick(INTERESTS)],
    level: 10 + (index % 10),
    isVip: Math.random() < 0.7,
    isVerified: true,
    gender: "female",
    quality: "premium",
    createdAt: Date.now(),
  };

  if (!isAutoCallEligibleProfile(profile)) {
    return generatePremiumFemaleProfile(index + 7, [
      ...avoidPackIds,
      media.id,
    ]);
  }
  return profile;
}

function readPool(): GeneratedFemaleProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GeneratedFemaleProfile[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (p) =>
            isAutoCallEligibleProfile(p) &&
            !!p.ringVideo &&
            !!p.mediaPackId,
        )
      : [];
  } catch {
    return [];
  }
}

function writePool(pool: GeneratedFemaleProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POOL_KEY, JSON.stringify(pool));
  } catch {
    /* ignore */
  }
}

/** Ensure a rotating pool of unique premium female identities exists */
export function ensurePremiumFemalePool(): GeneratedFemaleProfile[] {
  let pool = readPool();
  if (pool.length >= POOL_SIZE * 0.6) return pool;

  const next: GeneratedFemaleProfile[] = [...pool];
  const usedNames = new Set(next.map((p) => p.name.toLowerCase()));
  const usedPacks = next.map((p) => p.mediaPackId);

  for (let i = 0; next.length < POOL_SIZE && i < POOL_SIZE * 3; i++) {
    const p = generatePremiumFemaleProfile(i + next.length, usedPacks);
    if (usedNames.has(p.name.toLowerCase())) continue;
    usedNames.add(p.name.toLowerCase());
    usedPacks.push(p.mediaPackId);
    next.push(p);
  }
  writePool(next);
  return next;
}

/** Pick next profile avoiding recent host ids */
export function pickGeneratedFemaleProfile(
  recentHostIds: string[],
): GeneratedFemaleProfile {
  const pool = ensurePremiumFemalePool();
  const cool = new Set(recentHostIds.slice(0, 10));
  const fresh = pool.filter((p) => !cool.has(p.host_id));
  const choice = fresh.length ? pick(fresh) : pick(pool);

  if (Math.random() < 0.22) {
    const newborn = generatePremiumFemaleProfile(
      Date.now() % 100,
      pool.map((p) => p.mediaPackId),
    );
    const updated = [newborn, ...pool].slice(0, POOL_SIZE + 8);
    writePool(updated);
    return newborn;
  }
  return choice;
}

export function generatedToWelcomeHost(
  profile: GeneratedFemaleProfile,
  message: { id: string; text: string },
  durationPreview: string,
): WelcomePushHost {
  const cdnOverride = process.env.NEXT_PUBLIC_WELCOME_TEASER_URL;
  return {
    host_id: profile.host_id,
    name: profile.name,
    age: profile.age,
    avatar: profile.avatar,
    ring_video_url: profile.ringVideo,
    teaser_video_url: cdnOverride || profile.teaserVideo || PREMIUM_TEASER_URL,
    country: profile.country,
    flag: profile.flag,
    language: profile.language,
    bio: profile.bio,
    interests: profile.interests,
    level: profile.level,
    isVip: profile.isVip,
    isVerified: profile.isVerified,
    isOnline: true,
    durationPreview,
    message: message.text,
    messageId: message.id,
    source: "demo",
    mediaPackId: profile.mediaPackId,
  };
}
