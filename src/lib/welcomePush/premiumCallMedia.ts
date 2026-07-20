/**
 * Paired premium ring videos + glamorous woman thumbnails for mobile fake calls.
 */

import {
  MOBILE_FAKE_CALL_CLIPS,
  pickMobileFakeCallClip,
  pickRandomMobileFakeCallClip,
} from "./mobileFakeCallVideos";

export type PremiumCallMediaPack = {
  id: string;
  avatar: string;
  ringVideo: string;
  teaserVideo: string;
  vibe: "glam" | "selfie" | "fashion" | "soft" | "beach" | "pool" | "nightlife";
  region?: "asian" | "indian" | "pakistani" | "global";
};

export const PREMIUM_CALL_MEDIA: readonly PremiumCallMediaPack[] =
  MOBILE_FAKE_CALL_CLIPS.map((c) => ({
    id: c.id,
    vibe: c.vibe,
    region: c.region,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  }));

export function pickPremiumCallMedia(index = 0): PremiumCallMediaPack {
  const c = pickMobileFakeCallClip(index);
  return {
    id: c.id,
    vibe: c.vibe,
    region: c.region,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  };
}

export function pickRandomPremiumCallMedia(
  avoidIds: string[] = [],
): PremiumCallMediaPack {
  // Bias toward Asian / Indian / Pakistani packs for ring backgrounds
  const c = pickRandomMobileFakeCallClip(avoidIds, [
    "asian",
    "indian",
    "pakistani",
  ]);
  return {
    id: c.id,
    vibe: c.vibe,
    region: c.region,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  };
}

export const PREMIUM_FULLBODY_AVATARS = PREMIUM_CALL_MEDIA.map((p) => p.avatar);
