/**
 * Favorites + block + follow + recently viewed + reports (device-local; sync to API).
 */

const FAV_KEY = "zuko_favorites_v1";
const BLOCK_KEY = "zuko_blocked_v1";
const RECENT_KEY = "zuko_recent_hosts_v1";
const FOLLOW_KEY = "zuko_following_v1";
const REPORT_KEY = "zuko_reports_v1";

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids.slice(0, 200)));
}

export function getFavorites(): string[] {
  return readList(FAV_KEY);
}

export function isFavorite(hostId: string) {
  return getFavorites().includes(hostId);
}

export function toggleFavorite(hostId: string): boolean {
  const list = getFavorites();
  const next = list.includes(hostId)
    ? list.filter((id) => id !== hostId)
    : [hostId, ...list];
  writeList(FAV_KEY, next);
  return next.includes(hostId);
}

export function getBlocked(): string[] {
  return readList(BLOCK_KEY);
}

export function isBlocked(hostId: string) {
  return getBlocked().includes(hostId);
}

export function blockHost(hostId: string) {
  const list = getBlocked();
  if (!list.includes(hostId)) writeList(BLOCK_KEY, [hostId, ...list]);
}

export function unblockHost(hostId: string) {
  writeList(
    BLOCK_KEY,
    getBlocked().filter((id) => id !== hostId),
  );
}

export function getFollowing(): string[] {
  return readList(FOLLOW_KEY);
}

export function setFollowingList(ids: string[]) {
  writeList(FOLLOW_KEY, ids);
}

export function toggleFollowLocal(hostId: string): boolean {
  const list = getFollowing();
  const next = list.includes(hostId)
    ? list.filter((id) => id !== hostId)
    : [hostId, ...list];
  writeList(FOLLOW_KEY, next);
  return next.includes(hostId);
}

export function getRecentlyViewed(): string[] {
  return readList(RECENT_KEY);
}

export function markHostViewed(hostId: string) {
  const next = [hostId, ...getRecentlyViewed().filter((id) => id !== hostId)];
  writeList(RECENT_KEY, next.slice(0, 40));
}

export type HostReport = {
  id: string;
  hostId: string;
  reason: string;
  at: number;
};

export function reportHost(hostId: string, reason: string): HostReport {
  const report: HostReport = {
    id: `rpt_${Date.now().toString(36)}`,
    hostId,
    reason: reason.trim() || "Inappropriate behavior",
    at: Date.now(),
  };
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    const list: HostReport[] = raw ? (JSON.parse(raw) as HostReport[]) : [];
    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify([report, ...list].slice(0, 50)),
    );
  } catch {
    /* ignore */
  }
  return report;
}

export function filterBlockedHosts<T extends { id: string }>(hosts: T[]): T[] {
  const blocked = new Set(getBlocked());
  if (!blocked.size) return hosts;
  return hosts.filter((h) => !blocked.has(h.id));
}
