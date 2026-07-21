import type { LiveHost } from "@/lib/api";
import { creators, type Creator } from "@/lib/data";
import { pickHostAvatarUrl } from "@/lib/hostAvatar";

export type DiscoverHost = {
  id: string;
  name: string;
  avatarUrl: string;
  country: string;
  flag: string;
  language: string;
  rating: number;
  callRate: number;
  followers: number;
  verified: boolean;
  online: boolean;
  live: boolean;
  onCall: boolean;
  tags: string[];
  bio: string;
  isNew: boolean;
  trendingScore: number;
  nearby: boolean;
  recentlyActive: boolean;
  source: "live" | "catalog";
  gender: "female" | "male";
  age?: number;
};

const LANG_BY_COUNTRY: Record<string, string> = {
  Korea: "Korean",
  Brazil: "Portuguese",
  Japan: "Japanese",
  Turkey: "Turkish",
  UAE: "Arabic",
  Spain: "Spanish",
  USA: "English",
  Pakistan: "Urdu",
  India: "Hindi",
  UK: "English",
};

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function enrichCreator(c: Creator): DiscoverHost {
  const h = hash(c.id);
  return {
    id: c.id,
    name: c.name,
    avatarUrl: c.image,
    country: c.country,
    flag: c.flag,
    language: LANG_BY_COUNTRY[c.country] || "English",
    rating: c.rating,
    callRate: c.callRate,
    followers: 1200 + (h % 18000),
    verified: c.rating >= 4.7,
    online: c.online,
    live: c.live,
    onCall: false,
    tags: c.tags,
    bio: c.bio,
    isNew: h % 5 === 0,
    trendingScore: c.viewers + c.rating * 100,
    nearby: h % 3 === 0,
    recentlyActive: c.online || c.live,
    source: "catalog",
    gender: "female",
    age: c.age,
  };
}

function enrichLive(h: LiveHost, i: number): DiscoverHost {
  const seed = hash(h.id);
  const countries = Object.keys(LANG_BY_COUNTRY);
  const country = h.country || countries[seed % countries.length] || "USA";
  const flags: Record<string, string> = {
    Korea: "🇰🇷",
    Brazil: "🇧🇷",
    Japan: "🇯🇵",
    Turkey: "🇹🇷",
    UAE: "🇦🇪",
    Spain: "🇪🇸",
    USA: "🇺🇸",
    Pakistan: "🇵🇰",
    India: "🇮🇳",
    UK: "🇬🇧",
  };
  return {
    id: h.id,
    name: h.name,
    avatarUrl: pickHostAvatarUrl(
      { avatarUrl: h.avatarUrl },
      { hostId: h.id, name: h.name },
    ),
    country,
    flag: flags[country] || "🌍",
    language: LANG_BY_COUNTRY[country] || "English",
    rating: 4.5 + (seed % 50) / 100,
    callRate: h.ratePerMinute || 80,
    followers: 800 + (seed % 22000),
    verified: true,
    online: Boolean(h.isOnline || h.isLive || h.isOnCall),
    live: Boolean(h.isLive),
    onCall: Boolean(h.isOnCall && !h.isLive),
    tags: i % 2 === 0 ? ["Live", "Talk"] : ["Chill", "Music"],
    bio: "Online now · ready for a real conversation",
    isNew: seed % 4 === 0,
    trendingScore: (h.isLive ? 5000 : 0) + (h.isOnline ? 2000 : 0) + (seed % 900),
    nearby: seed % 3 === 0,
    recentlyActive: h.isOnline || h.isLive || h.isOnCall,
    source: "live",
    gender: "female",
    age: 20 + (seed % 8),
  };
}

export function mergeDiscoverHosts(live: LiveHost[]): DiscoverHost[] {
  // Only real online/live API hosts — never pad with offline catalog stubs
  return live
    .filter((h) => h.isOnline || h.isLive)
    .map(enrichLive);
}

/**
 * Catalog hosts for discovery fallback — keep real Online vs Live flags so
 * badges stay accurate (Online hosts on Call tab, Live hosts on Live tab).
 */
export function catalogDiscoverHosts(mode: "call" | "live"): DiscoverHost[] {
  return creators
    .map(enrichCreator)
    .filter((h) =>
      mode === "live" ? h.live === true : h.online === true && !h.live,
    )
    .map((h) => ({
      ...h,
      recentlyActive: true,
      source: "catalog" as const,
    }));
}

/**
 * Deterministic seeded shuffle (mulberry32 + Fisher–Yates). Given the same
 * seed the order is stable (so React renders don't thrash within a rotation
 * tick), while bumping the seed reshuffles — powering the auto-rotating,
 * never-static host feed.
 */
export function rotateHosts<T>(list: T[], seed: number): T[] {
  if (list.length <= 1) return list;
  const a = list.slice();
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function filterHosts(
  hosts: DiscoverHost[],
  opts: { query?: string; category?: string },
): DiscoverHost[] {
  const q = (opts.query || "").trim().toLowerCase();
  const cat = opts.category || "All";
  return hosts.filter((h) => {
    if (q) {
      const hay = `${h.name} ${h.country} ${h.language} ${h.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    switch (cat) {
      case "Trending":
        return h.trendingScore > 2500 || h.live;
      case "New":
        return h.isNew;
      case "Top Rated":
        return h.rating >= 4.8;
      case "Nearby":
        return h.nearby;
      case "Music":
        return h.tags.includes("Music");
      case "Chill":
        return (
          h.tags.includes("Chill") ||
          h.tags.includes("Calm") ||
          h.tags.includes("Talk")
        );
      case "Party":
        return h.tags.includes("Party") || h.tags.includes("Dance") || h.live;
      case "Language":
        return true;
      default:
        return true;
    }
  });
}

export function sectionHosts(hosts: DiscoverHost[]) {
  const online = hosts.filter((h) => h.online || h.live);
  const trending = [...hosts]
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 12);
  const newest = hosts.filter((h) => h.isNew).slice(0, 10);
  const topRated = [...hosts].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const recommended = [...hosts]
    .sort((a, b) => Number(b.online) - Number(a.online) || b.rating - a.rating)
    .slice(0, 10);
  const nearby = hosts.filter((h) => h.nearby).slice(0, 10);
  const recent = hosts.filter((h) => h.recentlyActive).slice(0, 10);
  return { online, trending, newest, topRated, recommended, nearby, recent };
}

export function findDiscoverHost(
  hosts: DiscoverHost[],
  id: string,
): DiscoverHost | undefined {
  return hosts.find((h) => h.id === id);
}

export function hostFromId(id: string, live: LiveHost[] = []): DiscoverHost {
  const merged = mergeDiscoverHosts(live);
  const hit = merged.find((h) => h.id === id);
  if (hit) return hit;
  // Profile deep-link fallback — mark offline so lists stay empty
  const seed = hash(id);
  const catalog = creators.find((c) => c.id === id);
  if (catalog) {
    const enriched = enrichCreator(catalog);
    return { ...enriched, online: false, live: false, recentlyActive: false };
  }
  return {
    id,
    name: "Host",
    avatarUrl: pickHostAvatarUrl({}, { hostId: id, name: "Host" }),
    country: "Pakistan",
    flag: "🇵🇰",
    language: "Urdu",
    rating: 4.8,
    callRate: 45,
    followers: 1200,
    verified: true,
    online: false,
    live: false,
    onCall: false,
    tags: ["Chat", "Call"],
    bio: "Host is offline right now.",
    isNew: false,
    trendingScore: 0,
    nearby: false,
    recentlyActive: false,
    source: "live",
    gender: "female",
    age: 22 + (seed % 6),
  };
}
