/**
 * Paired premium ring-loop videos + full-body glamorous female thumbnails.
 * Mobile-first: clips chosen for object-cover on phone screens (~30s fake call).
 */

import {
  MOBILE_FAKE_CALL_CLIPS,
  pickMobileFakeCallClip,
  pickRandomMobileFakeCallClip,
} from "./mobileFakeCallVideos";

export type PremiumCallMediaPack = {
  id: string;
  /** Full-view glamorous still (not tight face crop) */
  avatar: string;
  /** Short loop for ringing background */
  ringVideo: string;
  /** Clip for accept teaser (plays up to 30s) */
  teaserVideo: string;
  vibe: "beach" | "pool" | "fashion" | "nightlife" | "glam" | "selfie";
};

export const PREMIUM_CALL_MEDIA: readonly PremiumCallMediaPack[] =
  MOBILE_FAKE_CALL_CLIPS.map((c) => ({
    id: c.id,
    vibe: c.vibe,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  }));

export function pickPremiumCallMedia(index = 0): PremiumCallMediaPack {
  const c = pickMobileFakeCallClip(index);
  return {
    id: c.id,
    vibe: c.vibe,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  };
}

export function pickRandomPremiumCallMedia(
  avoidIds: string[] = [],
): PremiumCallMediaPack {
  const c = pickRandomMobileFakeCallClip(avoidIds);
  return {
    id: c.id,
    vibe: c.vibe,
    avatar: c.poster,
    ringVideo: c.videoUrl,
    teaserVideo: c.videoUrl,
  };
}

/** Flat avatar list for generators (always full-view curated) */
export const PREMIUM_FULLBODY_AVATARS = PREMIUM_CALL_MEDIA.map((p) => p.avatar);
