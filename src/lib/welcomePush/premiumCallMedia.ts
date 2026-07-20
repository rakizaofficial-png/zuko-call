/**
 * Paired premium ring-loop videos + full-body glamorous female thumbnails.
 * Avatar and ring video share the same aesthetic (beach / bikini / bold fashion).
 * Mixkit free stock — short clips loop cleanly behind the incoming-call UI.
 */

export type PremiumCallMediaPack = {
  id: string;
  /** Full-view glamorous still (not tight face crop) */
  avatar: string;
  /** Short loop for ringing background */
  ringVideo: string;
  /** Clip for accept teaser */
  teaserVideo: string;
  vibe: "beach" | "pool" | "fashion" | "nightlife" | "glam";
};

const U = (id: string, params = "w=900&h=1400&fit=crop&q=85") =>
  `https://images.unsplash.com/photo-${id}?${params}`;

/** Mixkit CDN — numeric path (preview slug URLs return 403) */
const M = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

/**
 * Strict curation: full-body / mid-shot glamorous female aesthetics.
 * Avoids tight face-only crops used previously.
 */
export const PREMIUM_CALL_MEDIA: readonly PremiumCallMediaPack[] = [
  {
    id: "bikini_beach_01",
    vibe: "beach",
    avatar: U("1496440737103-cd596325d314"),
    ringVideo: M(1215),
    teaserVideo: M(1215),
  },
  {
    id: "pool_pose_01",
    vibe: "pool",
    avatar: U("1529626455594-4ff0802cfb7e"),
    ringVideo: M(4154),
    teaserVideo: M(4154),
  },
  {
    id: "fashion_runway_01",
    vibe: "fashion",
    avatar: U("1515886657613-9f3515b0c78f"),
    ringVideo: M(39880),
    teaserVideo: M(39880),
  },
  {
    id: "neon_glam_01",
    vibe: "nightlife",
    avatar: U("1516726817505-f5ed825624d8"),
    ringVideo: M(1232),
    teaserVideo: M(1232),
  },
  {
    id: "beach_walk_01",
    vibe: "beach",
    avatar: U("1503104834685-7205e8607eb9"),
    ringVideo: M(3986),
    teaserVideo: M(3986),
  },
  {
    id: "bikini_shore_01",
    vibe: "beach",
    avatar: U("1469334031218-e382a71b716b"),
    ringVideo: M(2193),
    teaserVideo: M(2193),
  },
  {
    id: "club_energy_01",
    vibe: "nightlife",
    avatar: U("1524504388940-b1c1722653e1"),
    ringVideo: M(4271),
    teaserVideo: M(4271),
  },
  {
    id: "selfie_glam_01",
    vibe: "glam",
    avatar: U("1487412720507-e7ab37603c6f"),
    ringVideo: M(4303),
    teaserVideo: M(4303),
  },
  {
    id: "beach_breeze_01",
    vibe: "beach",
    avatar: U("1504703395950-b8917a3b0a4c"),
    ringVideo: M(3987),
    teaserVideo: M(3987),
  },
  {
    id: "beach_yoga_01",
    vibe: "beach",
    avatar: U("1526510747491-58f928ec870f"),
    ringVideo: M(3988),
    teaserVideo: M(3988),
  },
  {
    id: "balcony_glam_01",
    vibe: "glam",
    avatar: U("1534528741775-53994a69daeb", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(4270),
    teaserVideo: M(4270),
  },
  {
    id: "sea_sit_01",
    vibe: "beach",
    avatar: U("1494790108377-be9c29b29330", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(3989),
    teaserVideo: M(3989),
  },
  {
    id: "red_dress_01",
    vibe: "nightlife",
    avatar: U("1524504388940-b1c1722653e1", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(4271),
    teaserVideo: M(4271),
  },
  {
    id: "lingerie_glam_01",
    vibe: "glam",
    avatar: U("1516726817505-f5ed825624d8", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(1232),
    teaserVideo: M(1232),
  },
  {
    id: "poolside_adult_01",
    vibe: "pool",
    avatar: U("1529626455594-4ff0802cfb7e", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(4154),
    teaserVideo: M(4154),
  },
  {
    id: "sunset_bikini_01",
    vibe: "beach",
    avatar: U("1503104834685-7205e8607eb9", "w=900&h=1400&fit=crop&q=85"),
    ringVideo: M(3986),
    teaserVideo: M(3986),
  },
] as const;

export function pickPremiumCallMedia(index = 0): PremiumCallMediaPack {
  const i =
    ((index % PREMIUM_CALL_MEDIA.length) + PREMIUM_CALL_MEDIA.length) %
    PREMIUM_CALL_MEDIA.length;
  return PREMIUM_CALL_MEDIA[i]!;
}

export function pickRandomPremiumCallMedia(
  avoidIds: string[] = [],
): PremiumCallMediaPack {
  const cool = new Set(avoidIds.slice(0, 6));
  const fresh = PREMIUM_CALL_MEDIA.filter((p) => !cool.has(p.id));
  const pool = fresh.length ? fresh : PREMIUM_CALL_MEDIA;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Flat avatar list for generators (always full-view curated) */
export const PREMIUM_FULLBODY_AVATARS = PREMIUM_CALL_MEDIA.map((p) => p.avatar);
