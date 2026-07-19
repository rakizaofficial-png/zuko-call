import type { LiveHost } from "@/lib/api";
import { creators, type Creator } from "@/lib/data";

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
  /** Display gender for profile cards */
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
    avatarUrl:
      h.avatarUrl ||
      `https://images.unsplash.com/photo-${["1534528741775-53994a69daeb", "1524504388940-b1c1722653e1", "1494790108377-be9c29b29330", "1517841905240-472988babdf9"][seed % 4]}?w=600&h=800&fit=crop`,
    country,
    flag: flags[country] || "🌍",
    language: LANG_BY_COUNTRY[country] || "English",
    rating: 4.5 + (seed % 50) / 100,
    callRate: h.ratePerMinute || 80,
    followers: 800 + (seed % 22000),
    verified: true,
    online: h.isOnline,
    live: h.isLive,
    onCall: h.isOnCall,
    tags: i % 2 === 0 ? ["Live", "Talk"] : ["Chill", "Music"],
    bio: "Online now · ready for a real conversation",
    isNew: seed % 4 === 0,
    trendingScore: (h.isLive ? 5000 : 0) + (h.isOnline ? 2000 : 0) + seed % 900,
    nearby: seed % 3 === 0,
    recentlyActive: h.isOnline || h.isLive || h.isOnCall,
    source: "live",
    gender: "female",
    age: 20 + (seed % 8),
  };
}

export function mergeDiscoverHosts(live: LiveHost[]): DiscoverHost[] {
  const fromLive = live.map(enrichLive);
  const liveIds = new Set(fromLive.map((h) => h.id));
  const fromCatalog = creators
    .map(enrichCreator)
    .filter((c) => !liveIds.has(c.id));
  return [...fromLive, ...fromCatalog];
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
        return h.tags.includes("Chill") || h.tags.includes("Calm") || h.tags.includes("Talk");
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
  const trending = [...hosts].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 12);
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
  const seed = hash(id);
  return {
    id,
    name: "Host",
    avatarUrl: `https://i.pravatar.cc/800?u=${encodeURIComponent(id)}`,
    country: "Pakistan",
    flag: "🇵🇰",
    language: "Urdu",
    rating: 4.8,
    callRate: 45,
    followers: 1200,
    verified: true,
    online: true,
    live: false,
    onCall: false,
    tags: ["Chat", "Call"],
    bio: "Let's talk — tap Message or Call.",
    isNew: false,
    trendingScore: 1000,
    nearby: false,
    recentlyActive: true,
    source: "live",
    gender: "female",
    age: 22 + (seed % 6),
  };
}
