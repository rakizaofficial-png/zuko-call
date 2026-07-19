"use client";

/**
 * Direct messages (user ↔ host).
 * Local cache + CoinCall API so hosts see fan messages in Chat.
 */

import { requireApiBase } from "@/config/apiConfig";
import { getDeviceUserId } from "@/lib/walletApi";
import { getRealtimeClient } from "@/lib/realtime/websocket";

export type DmMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
  fromId?: string;
};

export type DmThread = {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  lastMessage: string;
  updatedAt: number;
  unread: number;
};

const THREADS_KEY = "luma_dm_threads_v1";
const MSGS_KEY = "luma_dm_msgs_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function threadIdForHost(hostId: string) {
  return `dm_${hostId}`;
}

export function listDmThreads(): DmThread[] {
  return readJson<DmThread[]>(THREADS_KEY, []).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function getDmMessages(threadId: string): DmMessage[] {
  const all = readJson<Record<string, DmMessage[]>>(MSGS_KEY, {});
  return all[threadId] || [];
}

function cacheThread(t: DmThread) {
  const threads = listDmThreads().filter((x) => x.id !== t.id);
  threads.unshift(t);
  writeJson(THREADS_KEY, threads);
}

function cacheMessages(threadId: string, messages: DmMessage[]) {
  const all = readJson<Record<string, DmMessage[]>>(MSGS_KEY, {});
  all[threadId] = messages;
  writeJson(MSGS_KEY, all);
}

export function openDmWithHost(input: {
  hostId: string;
  hostName: string;
  hostAvatar: string;
  seedMessage?: string;
}): string {
  const id = threadIdForHost(input.hostId);
  const threads = listDmThreads();
  const existing = threads.find((t) => t.id === id);
  const now = Date.now();

  if (!existing) {
    cacheThread({
      id,
      hostId: input.hostId,
      hostName: input.hostName,
      hostAvatar: input.hostAvatar,
      lastMessage: input.seedMessage || "Say hi 👋",
      updatedAt: now,
      unread: 0,
    });
    const msgs = getDmMessages(id);
    if (msgs.length === 0) {
      cacheMessages(id, [
        {
          id: `m_${now}`,
          from: "them",
          text: `Hey! It's ${input.hostName} ✨ Text me anytime.`,
          at: now,
        },
      ]);
    }
  } else {
    existing.hostName = input.hostName;
    existing.hostAvatar = input.hostAvatar;
    existing.updatedAt = now;
    writeJson(THREADS_KEY, threads);
  }

  return id;
}

export async function syncDmFromApi(hostId: string): Promise<DmMessage[]> {
  const userId = getDeviceUserId();
  const threadId = threadIdForHost(hostId);
  try {
    const res = await fetch(
      `${requireApiBase()}/dm/messages?a=${encodeURIComponent(userId)}&b=${encodeURIComponent(hostId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return getDmMessages(threadId);
    const data = (await res.json()) as {
      messages?: Array<{
        id: string;
        fromId: string;
        toId: string;
        text: string;
        createdAt: number;
      }>;
    };
    const mapped: DmMessage[] = (data.messages || []).map((m) => ({
      id: m.id,
      from: m.fromId === userId ? ("me" as const) : ("them" as const),
      text: m.text,
      at: m.createdAt,
      fromId: m.fromId,
    }));
    if (mapped.length) cacheMessages(threadId, mapped);
    return mapped.length ? mapped : getDmMessages(threadId);
  } catch {
    return getDmMessages(threadId);
  }
}

export async function sendDmMessage(
  threadId: string,
  text: string,
  meta?: { hostId: string; hostName: string; hostAvatar?: string },
): Promise<{ mine: DmMessage }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message");

  const userId = getDeviceUserId();
  const hostId = meta?.hostId || threadId.replace(/^dm_/, "");
  const now = Date.now();
  const optimistic: DmMessage = {
    id: `local_${now}`,
    from: "me",
    text: trimmed,
    at: now,
    fromId: userId,
  };

  const local = [...getDmMessages(threadId), optimistic];
  cacheMessages(threadId, local);
  cacheThread({
    id: threadId,
    hostId,
    hostName: meta?.hostName || "Host",
    hostAvatar: meta?.hostAvatar || "",
    lastMessage: trimmed,
    updatedAt: now,
    unread: 0,
  });

  const res = await fetch(`${requireApiBase()}/dm/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId: userId,
      toId: hostId,
      text: trimmed,
      fromName: "Luma Fan",
      fromRole: "user",
      peerName: meta?.hostName || "Host",
      peerAvatar: meta?.hostAvatar,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Send failed");

  const saved = data.message as {
    id: string;
    fromId: string;
    text: string;
    createdAt: number;
  };
  const mine: DmMessage = {
    id: saved.id,
    from: "me",
    text: saved.text,
    at: saved.createdAt,
    fromId: saved.fromId,
  };
  const withoutLocal = getDmMessages(threadId).filter((m) => m.id !== optimistic.id);
  if (!withoutLocal.some((m) => m.id === mine.id)) withoutLocal.push(mine);
  cacheMessages(threadId, withoutLocal);

  // Realtime fan-out is handled by the API (broadcastWs + pushToHost).
  // Do not also emit dm:send here — that would duplicate the message.

  return { mine };
}

export function appendDmReply(threadId: string, text: string): DmMessage {
  const now = Date.now();
  const reply: DmMessage = {
    id: `m_${now}_r`,
    from: "them",
    text,
    at: now,
  };
  cacheMessages(threadId, [...getDmMessages(threadId), reply]);
  const threads = listDmThreads();
  const t = threads.find((x) => x.id === threadId);
  if (t) {
    t.lastMessage = text;
    t.updatedAt = now;
    t.unread = (t.unread || 0) + 1;
    writeJson(THREADS_KEY, threads);
  }
  return reply;
}

export function markDmRead(threadId: string) {
  const threads = listDmThreads();
  const t = threads.find((x) => x.id === threadId);
  if (t) {
    t.unread = 0;
    writeJson(THREADS_KEY, threads);
  }
}

export function listenDmRealtime(
  hostId: string,
  userId: string,
  onMessage: (msg: DmMessage) => void,
): () => void {
  const rt = getRealtimeClient(userId);
  rt.connect();
  return rt.subscribe((ev) => {
    if ((ev as { type: string }).type !== "dm:message") return;
    const p = (ev as { payload?: { message?: { id: string; fromId: string; toId: string; text: string; createdAt: number } } }).payload;
    const m = p?.message;
    if (!m) return;
    const ids = [m.fromId, m.toId];
    if (!ids.includes(userId) || !ids.includes(hostId)) return;
    onMessage({
      id: m.id,
      from: m.fromId === userId ? "me" : "them",
      text: m.text,
      at: m.createdAt,
      fromId: m.fromId,
    });
  });
}
