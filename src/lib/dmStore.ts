"use client";

/**
 * Direct messages (user ↔ host) persisted in localStorage.
 * Opens from profile cards / host profile; shown in /messages.
 */

export type DmMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
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
    /* ignore quota */
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
    threads.unshift({
      id,
      hostId: input.hostId,
      hostName: input.hostName,
      hostAvatar: input.hostAvatar,
      lastMessage: input.seedMessage || "Say hi 👋",
      updatedAt: now,
      unread: 0,
    });
    writeJson(THREADS_KEY, threads);

    const msgs = getDmMessages(id);
    if (msgs.length === 0) {
      const welcome: DmMessage = {
        id: `m_${now}`,
        from: "them",
        text: `Hey! It's ${input.hostName} ✨ Text me anytime.`,
        at: now,
      };
      const all = readJson<Record<string, DmMessage[]>>(MSGS_KEY, {});
      all[id] = [welcome];
      writeJson(MSGS_KEY, all);
    }
  } else {
    existing.hostName = input.hostName;
    existing.hostAvatar = input.hostAvatar;
    existing.updatedAt = now;
    writeJson(THREADS_KEY, threads);
  }

  return id;
}

export function sendDmMessage(
  threadId: string,
  text: string,
): { mine: DmMessage; reply?: DmMessage } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message");

  const now = Date.now();
  const mine: DmMessage = {
    id: `m_${now}`,
    from: "me",
    text: trimmed,
    at: now,
  };

  const all = readJson<Record<string, DmMessage[]>>(MSGS_KEY, {});
  const list = all[threadId] || [];
  list.push(mine);
  all[threadId] = list;
  writeJson(MSGS_KEY, all);

  const threads = listDmThreads();
  const t = threads.find((x) => x.id === threadId);
  if (t) {
    t.lastMessage = trimmed;
    t.updatedAt = now;
    t.unread = 0;
    writeJson(THREADS_KEY, threads);
  }

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
  const all = readJson<Record<string, DmMessage[]>>(MSGS_KEY, {});
  const list = all[threadId] || [];
  list.push(reply);
  all[threadId] = list;
  writeJson(MSGS_KEY, all);

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
