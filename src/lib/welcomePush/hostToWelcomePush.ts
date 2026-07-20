import type { DiscoverHost } from "@/lib/discoverHosts";
import { isPublicHttpAvatar } from "@/lib/hostAvatar";
import { pickRandomPremiumCallMedia } from "@/lib/welcomePush/premiumCallMedia";
import type { WelcomePushHost } from "@/lib/welcomePush/types";

/**
 * Map a profile / live host into a Welcome Push caller.
 * Always pairs an adult glamorous media pack (ring + teaser video).
 * Uses the host's real DP when it is a public https photo; otherwise the pack still.
 */
export function discoverHostToWelcomePush(
  host: Pick<
    DiscoverHost,
    "id" | "name" | "avatarUrl" | "country" | "flag" | "language" | "bio" | "age" | "verified"
  >,
): WelcomePushHost {
  const pack = pickRandomPremiumCallMedia();
  const realDp =
    isPublicHttpAvatar(host.avatarUrl) &&
    !/ui-avatars\.com/i.test(host.avatarUrl)
      ? host.avatarUrl
      : pack.avatar;

  return {
    host_id: host.id,
    name: host.name || "Host",
    age: host.age || 22,
    avatar: realDp,
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
    message: `${host.name.split(" ")[0] || "Hey"}, I'm free right now — video call?`,
    messageId: `profile_${host.id}_${Date.now()}`,
    source: "live",
    mediaPackId: pack.id,
  };
}
