import type { DiscoverHost } from "@/lib/discoverHosts";
import { pickRandomPremiumCallMedia } from "@/lib/welcomePush/premiumCallMedia";
import type { WelcomePushHost } from "@/lib/welcomePush/types";

/**
 * Map a profile / live host into a Welcome Push caller.
 * Always pairs an adult glamorous media pack (ring + teaser video).
 * Prefer pack girl still for ring UI when host DP is missing/placeholder.
 */
export function discoverHostToWelcomePush(
  host: Pick<
    DiscoverHost,
    "id" | "name" | "avatarUrl" | "country" | "flag" | "language" | "bio" | "age" | "verified"
  >,
): WelcomePushHost {
  const pack = pickRandomPremiumCallMedia();

  const displayName =
    host.name && host.name !== "Host" ? host.name : pack.id.includes("india")
      ? "Priya"
      : pack.id.includes("pak")
        ? "Noor"
        : pack.id.includes("asia")
          ? "Mira"
          : "Aisha";

  return {
    host_id: host.id,
    name: displayName,
    age: host.age || 22,
    // Ring background must be glam girl still (never city / crowd footage)
    avatar: pack.avatar,
    ring_video_url: pack.ringVideo,
    teaser_video_url:
      process.env.NEXT_PUBLIC_WELCOME_TEASER_URL || pack.teaserVideo,
    country: host.country || "USA",
    flag: host.flag || "🌍",
    language: host.language || "English",
    bio: host.bio || "Online now · private video?",
    interests: ["Chat", "Video"],
    level: 10,
    isVip: true,
    isVerified: Boolean(host.verified),
    isOnline: true,
    durationPreview: "a few minutes",
    message: `${displayName.split(" ")[0]}, I'm free right now — video call?`,
    messageId: `profile_${host.id}_${Date.now()}`,
    source: "live",
    mediaPackId: pack.id,
  };
}
