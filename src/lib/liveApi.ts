"use client";

import { requireApiBase } from "@/config/apiConfig";
import { apiConfig } from "@/config/apiConfig";
import { parseRoomLocked } from "@/lib/liveLock";

export type HostOnlyLiveRoom = {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  title?: string;
  channel: string;
  viewers: number;
  giftCoins: number;
  isLive: boolean;
  mode?: string;
  country?: string;
  /** Host locked the stream — viewers must unlock with a gift */
  locked: boolean;
  unlockCoins: number;
  unlockGiftId?: string;
};

export type LiveComment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
  kind: "comment" | "join" | "leave" | "follow" | "system" | "gift";
  giftEmoji?: string;
  giftCoins?: number;
};

export type LiveRoomAccess = {
  allowed: boolean;
  alreadyPaid?: boolean;
  entryFee?: number;
  reason?: string;
};

function mapRoom(
  r: Record<string, unknown>,
  extras?: { channel?: string; giftCoins?: number; viewers?: number },
  fallbackHostId?: string,
): HostOnlyLiveRoom {
  const hostId = String(r.hostId || fallbackHostId || "");
  const lock = parseRoomLocked(r);
  return {
    id: String(r.id || `live_${hostId}`),
    hostId,
    hostName: String(r.hostName || "Host"),
    hostAvatar: r.hostAvatar ? String(r.hostAvatar) : undefined,
    title: r.title ? String(r.title) : "Live now",
    channel: String(extras?.channel || r.channel || `live_${hostId}`),
    viewers: Number(extras?.viewers ?? r.viewers ?? 0),
    giftCoins: Number(extras?.giftCoins ?? r.giftCoins ?? 0),
    isLive: r.isLive !== false && Boolean(r.isLive ?? true),
    mode: r.mode ? String(r.mode) : "solo",
    country: r.country ? String(r.country) : undefined,
    locked: lock.locked,
    unlockCoins: lock.unlockCoins,
    unlockGiftId: lock.unlockGiftId,
  };
}

export async function fetchHostOnlyLiveRoom(
  idOrHost: string,
): Promise<HostOnlyLiveRoom | null> {
  const res = await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(idOrHost)}`,
    { cache: "no-store" },
  );
  if (res.ok) {
    const data = (await res.json()) as {
      room: Record<string, unknown>;
      channel?: string;
      giftCoins?: number;
      viewers?: number;
    };
    const r = data.room || {};
    const mapped = mapRoom(
      r,
      {
        channel: data.channel,
        giftCoins: data.giftCoins,
        viewers: data.viewers,
      },
      idOrHost,
    );
    mapped.isLive = Boolean(r.isLive);
    return mapped;
  }

  // Fallback: list endpoint + host presence (works before single-room route is deployed)
  try {
    const [roomsRes, hostsRes] = await Promise.all([
      fetch(`${requireApiBase()}/live/rooms`, { cache: "no-store" }),
      fetch(`${requireApiBase()}/hosts`, { cache: "no-store" }),
    ]);
    const roomsData = roomsRes.ok
      ? ((await roomsRes.json()) as { rooms?: Record<string, unknown>[] })
      : { rooms: [] };
    const hostsData = hostsRes.ok
      ? ((await hostsRes.json()) as {
          hosts?: Array<{
            id: string;
            name: string;
            avatarUrl?: string;
            isLive?: boolean;
            country?: string;
            isPremium?: boolean;
            locked?: boolean;
          }>;
        })
      : { hosts: [] };

    const rooms = roomsData.rooms || [];
    const hit =
      rooms.find(
        (r) =>
          String(r.id) === idOrHost ||
          String(r.hostId) === idOrHost ||
          String(r.id) === `live_${idOrHost}`,
      ) || null;

    if (hit && hit.isLive !== false) {
      const mapped = mapRoom(hit, undefined, idOrHost);
      mapped.isLive = true;
      return mapped;
    }

    const host = (hostsData.hosts || []).find(
      (h) => h.id === idOrHost && h.isLive,
    );
    if (host) {
      const lock = parseRoomLocked(host as unknown as Record<string, unknown>);
      return {
        id: `live_${host.id}`,
        hostId: host.id,
        hostName: host.name,
        hostAvatar: host.avatarUrl,
        title: "Live now",
        channel: `live_${host.id}`,
        viewers: 0,
        giftCoins: 0,
        isLive: true,
        mode: lock.locked ? "premium" : "solo",
        country: host.country,
        locked: lock.locked,
        unlockCoins: lock.unlockCoins,
        unlockGiftId: lock.unlockGiftId,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function checkLiveRoomAccess(
  roomId: string,
  userId: string,
): Promise<LiveRoomAccess> {
  const qs = new URLSearchParams({ userId });
  const res = await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(roomId)}/access?${qs}`,
    {
      cache: "no-store",
      headers: { "X-User-Id": userId },
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data.error || data.message || "Access check failed"));
  }
  return {
    allowed: Boolean(data.allowed ?? data.hasAccess ?? data.alreadyPaid),
    alreadyPaid: Boolean(data.alreadyPaid ?? data.paid),
    entryFee: Number(data.entryFee ?? data.unlockCoins ?? 0) || undefined,
    reason: data.reason ? String(data.reason) : undefined,
  };
}

export async function joinLiveRoomPaid(
  roomId: string,
  input: { userId: string; userName: string },
): Promise<LiveRoomAccess> {
  const res = await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": input.userId,
      },
      body: JSON.stringify(input),
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = String(data.error || data.message || "Could not unlock live");
    const err = new Error(message);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return {
    allowed: Boolean(data.allowed ?? data.joined ?? data.alreadyPaid ?? true),
    alreadyPaid: Boolean(data.alreadyPaid ?? data.paid),
    entryFee: Number(data.entryFee ?? data.unlockCoins ?? 0) || undefined,
    reason: data.reason ? String(data.reason) : undefined,
  };
}

export async function fetchLiveAgoraToken(
  channel: string,
  uid: number,
  opts?: { userId?: string; hostId?: string },
) {
  const qs = new URLSearchParams({
    channel,
    uid: String(uid),
    role: "subscriber",
  });
  if (opts?.userId) qs.set("userId", opts.userId);
  if (opts?.hostId) qs.set("hostId", opts.hostId);

  // Prefer /live/token — enforces coin-locked entry when userId is present.
  const liveRes = await fetch(`${requireApiBase()}/live/token?${qs}`, {
    cache: "no-store",
    headers: opts?.userId ? { "X-User-Id": opts.userId } : undefined,
  });
  if (liveRes.ok) {
    return (await liveRes.json()) as {
      token: string;
      appId: string;
      uid: number;
      channel: string;
    };
  }
  const liveData = (await liveRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (liveRes.status === 402) {
    const err = new Error(
      String(liveData.error || "Payment required to enter live"),
    );
    (err as Error & { status?: number; entryFee?: number }).status = 402;
    (err as Error & { entryFee?: number }).entryFee = Number(
      liveData.entryFee || 0,
    );
    throw err;
  }

  // Legacy fallback for older API deployments
  const res = await fetch(`${requireApiBase()}/agora/token?${qs}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Token failed");
  return data as { token: string; appId: string; uid: number; channel: string };
}

export async function fetchLiveComments(roomId: string): Promise<LiveComment[]> {
  const res = await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(roomId)}/comments`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { comments?: LiveComment[] };
  return data.comments || [];
}

export async function postLiveComment(input: {
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  hostId?: string;
}) {
  const res = await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(input.roomId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Comment failed");
  return data.comment as LiveComment;
}

export async function bumpLiveViewers(input: {
  roomId: string;
  delta: number;
  userId: string;
  userName: string;
}) {
  await fetch(
    `${requireApiBase()}/live/rooms/${encodeURIComponent(input.roomId)}/viewers`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  ).catch(() => undefined);
}

export function resolveAgoraAppId(serverAppId?: string) {
  return serverAppId || apiConfig.agora.appId;
}
