"use client";

/**
 * Live chat for Host-Only streams.
 * Uses CoinCall REST + WebSocket as the reliable path.
 * Also mirrors to Firebase RTDB when configured (same paths as host app).
 */

import {
  onValue,
  push,
  ref,
  set,
  type Unsubscribe,
} from "firebase/database";
import { getFirebaseDb, isFirebaseReady } from "@/lib/firebase";
import {
  fetchLiveComments,
  postLiveComment,
  type LiveComment,
} from "@/lib/liveApi";
import { getRealtimeClient } from "@/lib/realtime/websocket";

export function listenLiveComments(
  roomId: string,
  userId: string,
  onComments: (items: LiveComment[]) => void,
): () => void {
  let dead = false;
  const merge = new Map<string, LiveComment>();

  const emit = () => {
    if (dead) return;
    onComments(
      [...merge.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-80),
    );
  };

  const ingest = (rows: LiveComment[]) => {
    for (const c of rows) {
      if (c?.id) merge.set(c.id, c);
    }
    emit();
  };

  const load = async () => {
    try {
      const rows = await fetchLiveComments(roomId);
      ingest(rows);
    } catch {
      /* keep last */
    }
  };

  void load();
  const poll = setInterval(() => void load(), 2500);

  const rt = getRealtimeClient(userId);
  rt.connect();
  const off = rt.subscribe((ev) => {
    if (ev.type !== "live:comment") return;
    const payload = ev.payload as {
      roomId?: string;
      comment?: LiveComment;
    };
    if (!payload.comment) return;
    if (
      payload.roomId &&
      payload.roomId !== roomId &&
      payload.roomId !== `live_${roomId}` &&
      !roomId.endsWith(payload.roomId)
    ) {
      // still accept if hostId matches room suffix
      const hostPart = roomId.replace(/^live_/, "");
      if (payload.roomId !== `live_${hostPart}`) return;
    }
    merge.set(payload.comment.id, payload.comment);
    emit();
  });

  let unsubFb: Unsubscribe | undefined;
  const db = getFirebaseDb();
  if (isFirebaseReady() && db) {
    unsubFb = onValue(ref(db, `liveRooms/${roomId}/comments`), (snap) => {
      if (!snap.exists()) return;
      const val = snap.val() as Record<string, Omit<LiveComment, "id">>;
      ingest(
        Object.entries(val).map(([id, row]) => ({ id, ...row })),
      );
    });
  }

  return () => {
    dead = true;
    clearInterval(poll);
    off();
    unsubFb?.();
  };
}

/** Optimistically show a pending comment in the UI */
export function makeOptimisticComment(input: {
  userId: string;
  userName: string;
  text: string;
}): LiveComment {
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    userName: input.userName,
    text: input.text,
    createdAt: Date.now(),
    kind: "comment",
  };
}

export async function sendLiveComment(input: {
  roomId: string;
  hostId?: string;
  userId: string;
  userName: string;
  text: string;
}): Promise<LiveComment> {
  // Always hit API first (works without Firebase)
  const comment = await postLiveComment({
    roomId: input.roomId,
    userId: input.userId,
    userName: input.userName,
    text: input.text,
    hostId: input.hostId,
  });

  // Best-effort Firebase mirror for host apps that only listen on RTDB
  try {
    const db = getFirebaseDb();
    if (isFirebaseReady() && db) {
      const r = push(ref(db, `liveRooms/${input.roomId}/comments`));
      await set(r, {
        userId: input.userId,
        userName: input.userName,
        text: input.text,
        createdAt: comment.createdAt || Date.now(),
        kind: "comment",
      });
    }
  } catch {
    /* optional */
  }

  return comment;
}

export function listenRoomGiftCoins(
  roomId: string,
  onCoins: (giftCoins: number, viewers?: number) => void,
): () => void {
  const db = getFirebaseDb();
  if (isFirebaseReady() && db) {
    const unsub = onValue(ref(db, `liveRooms/${roomId}`), (snap) => {
      if (!snap.exists()) return;
      const v = snap.val() as { giftCoins?: number; viewers?: number };
      onCoins(Number(v.giftCoins || 0), Number(v.viewers || 0));
    });
    return () => unsub();
  }
  return () => undefined;
}
