/**
 * Mobile-first fake video-call clips (portrait-friendly Mixkit MP4s).
 *
 * NOTE: Sites like vidizzy.com use live peer streams — we cannot scrape or
 * reuse their private WebRTC media. Host your own licensed 30s vertical MP4s
 * via NEXT_PUBLIC_FAKE_CALL_VIDEOS (comma-separated https URLs) or the admin
 * media library (category: teaser / welcome).
 */

export type MobileFakeCallClip = {
  id: string;
  /** Vertical / phone-framed still poster (Unsplash) */
  poster: string;
  /** Short MP4 that covers well in object-cover on phones */
  videoUrl: string;
  vibe: "beach" | "pool" | "fashion" | "nightlife" | "glam" | "selfie";
};

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=720&h=1280&fit=crop&q=85`;

/** Mixkit 720p — works as object-cover on mobile */
const M = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

/**
 * Curated mobile clips for fake ringing + 30s accepted “live” preview.
 * Prefer selfie / mid-shot aesthetics that fill a phone screen.
 */
export const MOBILE_FAKE_CALL_CLIPS: readonly MobileFakeCallClip[] = [
  {
    id: "m_beach_01",
    vibe: "beach",
    poster: U("1496440737103-cd596325d314"),
    videoUrl: M(1215),
  },
  {
    id: "m_pool_01",
    vibe: "pool",
    poster: U("1529626455594-4ff0802cfb7e"),
    videoUrl: M(4154),
  },
  {
    id: "m_fashion_01",
    vibe: "fashion",
    poster: U("1515886657613-9f3515b0c78f"),
    videoUrl: M(39880),
  },
  {
    id: "m_neon_01",
    vibe: "nightlife",
    poster: U("1516726817505-f5ed825624d8"),
    videoUrl: M(1232),
  },
  {
    id: "m_walk_01",
    vibe: "beach",
    poster: U("1503104834685-7205e8607eb9"),
    videoUrl: M(3986),
  },
  {
    id: "m_shore_01",
    vibe: "beach",
    poster: U("1469334031218-e382a71b716b"),
    videoUrl: M(2193),
  },
  {
    id: "m_club_01",
    vibe: "nightlife",
    poster: U("1524504388940-b1c1722653e1"),
    videoUrl: M(4271),
  },
  {
    id: "m_glam_01",
    vibe: "glam",
    poster: U("1487412720507-e7ab37603c6f"),
    videoUrl: M(4303),
  },
  {
    id: "m_breeze_01",
    vibe: "beach",
    poster: U("1504703395950-b8917a3b0a4c"),
    videoUrl: M(3987),
  },
  {
    id: "m_yoga_01",
    vibe: "beach",
    poster: U("1526510747491-58f928ec870f"),
    videoUrl: M(3988),
  },
  {
    id: "m_balcony_01",
    vibe: "glam",
    poster: U("1534528741775-53994a69daeb"),
    videoUrl: M(4270),
  },
  {
    id: "m_selfie_01",
    vibe: "selfie",
    poster: U("1494790108377-be9c29b29330"),
    videoUrl: M(3989),
  },
  {
    id: "m_city_01",
    vibe: "fashion",
    poster: U("1524504388940-b1c1722653e1"),
    videoUrl: M(3245),
  },
  {
    id: "m_soft_01",
    vibe: "glam",
    poster: U("1516726817505-f5ed825624d8"),
    videoUrl: M(3451),
  },
  {
    id: "m_glow_01",
    vibe: "nightlife",
    poster: U("1487412720507-e7ab37603c6f"),
    videoUrl: M(4872),
  },
  {
    id: "m_wave_01",
    vibe: "beach",
    poster: U("1503104834685-7205e8607eb9"),
    videoUrl: M(5335),
  },
];

/** Optional override: NEXT_PUBLIC_FAKE_CALL_VIDEOS=url1,url2,url3 */
export function envFakeCallVideos(): string[] {
  const raw = (process.env.NEXT_PUBLIC_FAKE_CALL_VIDEOS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http://") || s.startsWith("https://"));
}

export function pickMobileFakeCallClip(index = 0): MobileFakeCallClip {
  const env = envFakeCallVideos();
  if (env.length) {
    const i = ((index % env.length) + env.length) % env.length;
    const url = env[i]!;
    return {
      id: `env_${i}`,
      vibe: "glam",
      poster: MOBILE_FAKE_CALL_CLIPS[i % MOBILE_FAKE_CALL_CLIPS.length]!.poster,
      videoUrl: url,
    };
  }
  const i =
    ((index % MOBILE_FAKE_CALL_CLIPS.length) + MOBILE_FAKE_CALL_CLIPS.length) %
    MOBILE_FAKE_CALL_CLIPS.length;
  return MOBILE_FAKE_CALL_CLIPS[i]!;
}

export function pickRandomMobileFakeCallClip(
  avoidIds: string[] = [],
): MobileFakeCallClip {
  const env = envFakeCallVideos();
  if (env.length) {
    const url = env[Math.floor(Math.random() * env.length)]!;
    const base =
      MOBILE_FAKE_CALL_CLIPS[
        Math.floor(Math.random() * MOBILE_FAKE_CALL_CLIPS.length)
      ]!;
    return {
      id: `env_${url.slice(-12)}`,
      vibe: base.vibe,
      poster: base.poster,
      videoUrl: url,
    };
  }
  const cool = new Set(avoidIds.slice(0, 6));
  const fresh = MOBILE_FAKE_CALL_CLIPS.filter((c) => !cool.has(c.id));
  const pool = fresh.length ? fresh : MOBILE_FAKE_CALL_CLIPS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Fake-call preview length — 30 seconds then paywall / loop */
export const FAKE_CALL_PREVIEW_MS = 30_000;
