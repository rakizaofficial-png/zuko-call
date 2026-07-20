/**
 * Mobile fake-call media — portrait girl clips + South/East Asian glam stills.
 * Ring backgrounds must be women (never city crowds / traffic).
 */

export type MobileFakeCallClip = {
  id: string;
  region: "asian" | "indian" | "pakistani" | "global";
  /** Glamorous woman still — used as Ken Burns + video poster */
  poster: string;
  /** Portrait (9:16) MP4 when available; otherwise empty → Ken Burns only */
  videoUrl: string;
  vibe: "glam" | "selfie" | "fashion" | "soft";
};

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=720&h=1280&fit=crop&q=85&crop=faces`;

/** Verified portrait Pexels files (720×1280) — woman on camera */
const PEXELS_PORTRAIT = {
  waiting_01:
    "https://videos.pexels.com/video-files/2499611/2499611-hd_720_1280_30fps.mp4",
  waiting_02:
    "https://videos.pexels.com/video-files/6010878/6010878-hd_720_1280_30fps.mp4",
} as const;

/**
 * Curated “waiting for you” packs — Asian / Indian / Pakistani aesthetic posters
 * paired with portrait waiting videos (object-cover on phones).
 */
export const MOBILE_FAKE_CALL_CLIPS: readonly MobileFakeCallClip[] = [
  {
    id: "asia_glam_01",
    region: "asian",
    vibe: "glam",
    poster: U("1531746020798-e6953c440e19"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "asia_soft_01",
    region: "asian",
    vibe: "soft",
    poster: U("1589156280159-276898a88479"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
  {
    id: "asia_fashion_01",
    region: "asian",
    vibe: "fashion",
    poster: U("1517841905240-472988babdf9"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "india_glam_01",
    region: "indian",
    vibe: "glam",
    poster: U("1594744803329-e922feee73db"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
  {
    id: "india_soft_01",
    region: "indian",
    vibe: "soft",
    poster: U("1573496359142-b8d87734a5a2"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "india_selfie_01",
    region: "indian",
    vibe: "selfie",
    poster: U("1544005313-94ddf0286df2"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
  {
    id: "pak_glam_01",
    region: "pakistani",
    vibe: "glam",
    poster: U("1524504388940-b1c1722653e1"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "pak_soft_01",
    region: "pakistani",
    vibe: "soft",
    poster: U("1487412720507-e7ab37603c6f"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
  {
    id: "asia_wait_01",
    region: "asian",
    vibe: "selfie",
    poster: U("1534528741775-53994a69daeb"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "india_wait_01",
    region: "indian",
    vibe: "fashion",
    poster: U("1529626455594-4ff0802cfb7e"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
  {
    id: "pak_wait_01",
    region: "pakistani",
    vibe: "glam",
    poster: U("1494790108377-be9c29b29330"),
    videoUrl: PEXELS_PORTRAIT.waiting_01,
  },
  {
    id: "asia_glow_01",
    region: "asian",
    vibe: "glam",
    poster: U("1502823403499-6ccfcf4fb453"),
    videoUrl: PEXELS_PORTRAIT.waiting_02,
  },
];

/** Optional override: NEXT_PUBLIC_FAKE_CALL_VIDEOS=url1,url2 */
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
    const base = MOBILE_FAKE_CALL_CLIPS[i % MOBILE_FAKE_CALL_CLIPS.length]!;
    return { ...base, id: `env_${i}`, videoUrl: env[i]! };
  }
  const i =
    ((index % MOBILE_FAKE_CALL_CLIPS.length) + MOBILE_FAKE_CALL_CLIPS.length) %
    MOBILE_FAKE_CALL_CLIPS.length;
  return MOBILE_FAKE_CALL_CLIPS[i]!;
}

export function pickRandomMobileFakeCallClip(
  avoidIds: string[] = [],
  preferRegions?: Array<MobileFakeCallClip["region"]>,
): MobileFakeCallClip {
  const env = envFakeCallVideos();
  if (env.length) {
    const url = env[Math.floor(Math.random() * env.length)]!;
    const base =
      MOBILE_FAKE_CALL_CLIPS[
        Math.floor(Math.random() * MOBILE_FAKE_CALL_CLIPS.length)
      ]!;
    return { ...base, id: `env_${url.slice(-10)}`, videoUrl: url };
  }

  let pool = [...MOBILE_FAKE_CALL_CLIPS];
  if (preferRegions?.length) {
    const preferred = pool.filter((c) => preferRegions.includes(c.region));
    if (preferred.length) pool = preferred;
  }
  const cool = new Set(avoidIds.slice(0, 6));
  const fresh = pool.filter((c) => !cool.has(c.id));
  const finalPool = fresh.length ? fresh : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)]!;
}

export const FAKE_CALL_PREVIEW_MS = 30_000;
