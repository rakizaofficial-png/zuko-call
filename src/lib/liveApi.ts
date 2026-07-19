"use client";

import { requireApiBase } from "@/config/apiConfig";
import { apiConfig } from "@/config/apiConfig";

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
    const hostId = String(r.hostId || idOrHost);
    return {
      id: String(r.id || `live_${hostId}`),
      hostId,
      hostName: String(r.hostName || "Host"),
      hostAvatar: r.hostAvatar ? String(r.hostAvatar) : undefined,
      title: r.title ? String(r.title) : "Live now",
      channel: String(data.channel || r.channel || `live_${hostId}`),
      viewers: Number(data.viewers ?? r.viewers ?? 0),
      giftCoins: Number(data.giftCoins ?? r.giftCoins ?? 0),
      isLive: Boolean(r.isLive),
      mode: r.mode ? String(r.mode) : "solo",
      country: r.country ? String(r.country) : undefined,
    };
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
      const hostId = String(hit.hostId || idOrHost);
      return {
        id: String(hit.id || `live_${hostId}`),
        hostId,
        hostName: String(hit.hostName || "Host"),
        hostAvatar: hit.hostAvatar ? String(hit.hostAvatar) : undefined,
        title: hit.title ? String(hit.title) : "Live now",
        channel: String(hit.channel || `live_${hostId}`),
        viewers: Number(hit.viewers || 0),
        giftCoins: Number(hit.giftCoins || 0),
        isLive: true,
        mode: hit.mode ? String(hit.mode) : "solo",
      };
    }

    const host = (hostsData.hosts || []).find(
      (h) => h.id === idOrHost && h.isLive,
    );
    if (host) {
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
        mode: "solo",
        country: host.country,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchLiveAgoraToken(channel: string, uid: number) {
  const qs = new URLSearchParams({
    channel,
    uid: String(uid),
    role: "subscriber",
  });
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
