/**
 * Smart Auto Call — client API (server-scheduled invitations).
 */

import { requireApiBase } from "@/config/apiConfig";
import { ensureDeviceUserId } from "@/lib/userProfile";

export type AutoCallInvite = {
  id: string;
  userId: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  hostCountry?: string;
  ratePerMinute: number;
  reason: "zero_balance_auto" | "host_manual_allowed";
  status: string;
  createdAt: number;
  expiresAt: number;
  matchScore: number;
};

export type AutoCallStatus = {
  enabled: boolean;
  eligible: boolean;
  coinBalance: number | null;
  invitesThisHour: number;
  maxPerHour: number;
  nextInviteAt: number | null;
  pending: AutoCallInvite | null;
};

async function autoCallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = ensureDeviceUserId();
  const res = await fetch(`${requireApiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data as T;
}

export async function fetchAutoCallStatus(): Promise<AutoCallStatus> {
  const userId = ensureDeviceUserId();
  const data = await autoCallFetch<{ status: AutoCallStatus }>(
    `/auto-call/status?userId=${encodeURIComponent(userId)}`,
  );
  return data.status;
}

export async function setAutoCallEnabled(
  enabled: boolean,
): Promise<AutoCallStatus> {
  const userId = ensureDeviceUserId();
  const data = await autoCallFetch<{ status: AutoCallStatus }>(
    "/auto-call/prefs",
    {
      method: "POST",
      body: JSON.stringify({ userId, enabled }),
    },
  );
  return data.status;
}

export async function heartbeatAutoCall(input: {
  coinBalance: number;
  language?: string;
  country?: string;
  interests?: string[];
  following?: string[];
  recentHostIds?: string[];
  viewingHostId?: string | null;
  inCall?: boolean;
}): Promise<{ status: AutoCallStatus; pending: AutoCallInvite | null }> {
  const userId = ensureDeviceUserId();
  return autoCallFetch("/auto-call/heartbeat", {
    method: "POST",
    body: JSON.stringify({ userId, ...input }),
  });
}

export async function respondAutoCallInvite(
  inviteId: string,
  action: "accept" | "decline",
): Promise<AutoCallInvite> {
  const userId = ensureDeviceUserId();
  const data = await autoCallFetch<{ invite: AutoCallInvite }>(
    "/auto-call/respond",
    {
      method: "POST",
      body: JSON.stringify({ userId, inviteId, action }),
    },
  );
  return data.invite;
}

const RECENT_KEY = "luma_recent_hosts_v1";

export function pushRecentHost(hostId: string) {
  if (typeof window === "undefined" || !hostId) return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [hostId, ...list.filter((id) => id !== hostId)].slice(0, 40);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readRecentHosts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as string[]).map(String).slice(0, 40);
  } catch {
    return [];
  }
}
