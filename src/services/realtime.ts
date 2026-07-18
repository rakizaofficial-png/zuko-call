/**
 * ============================================================================
 * REALTIME CLIENT — WebSocket + Firebase listeners
 * ============================================================================
 *
 * SETUP — WEBSOCKET (primary for call alerts / gifts / party chat)
 * 1. CoinCall API exposes `wss://YOUR-API/ws` (see server/index.ts)
 * 2. Set NEXT_PUBLIC_WS_URL if the WS host differs from the REST API
 * 3. Authenticate with `?token=JWT` or first message `{ type: "auth", token }`
 *
 * SETUP — FIREBASE CLOUD MESSAGING (push when app backgrounded)
 * 1. Firebase Console → Cloud Messaging → Web Push certificates → VAPID
 * 2. Fill NEXT_PUBLIC_FIREBASE_* in .env.local
 * 3. Request notification permission → get FCM token → POST /api/users/fcm-token
 *
 * SETUP — FIREBASE REALTIME DATABASE (optional party chat sync)
 * 1. Enable Realtime Database
 * 2. Rules: auth != null for /party/{roomId}/messages
 * 3. Set NEXT_PUBLIC_FIREBASE_DATABASE_URL
 * ============================================================================
 */

import { env, resolveWsUrl } from "@/config/env";
import { getSessionToken } from "@/services/walletApi";

export type RealtimeEvent =
  | { type: "connected"; userId?: string }
  | { type: "incoming_call"; callId: string; hostId: string; hostName: string }
  | { type: "call_status"; callId: string; status: string }
  | {
      type: "gift";
      roomId?: string;
      callId?: string;
      fromUserId: string;
      giftId: string;
      coins: number;
      emoji?: string;
    }
  | {
      type: "party_message";
      roomId: string;
      userId: string;
      userName: string;
      text: string;
      at: number;
    }
  | { type: "wallet_updated"; coins: number; xp: number }
  | { type: "error"; message: string };

type Handler = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
const handlers = new Set<Handler>();

export function subscribeRealtime(handler: Handler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

function emit(event: RealtimeEvent) {
  handlers.forEach((h) => {
    try {
      h(event);
    } catch {
      /* isolate listener errors */
    }
  });
}

export function connectRealtime(userId: string) {
  if (typeof window === "undefined") return;
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const token = getSessionToken() || "";
  const base = resolveWsUrl();
  const url = `${base}${base.includes("?") ? "&" : "?"}userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    socket?.send(
      JSON.stringify({
        type: "auth",
        userId,
        token,
        role: "user",
      }),
    );
    emit({ type: "connected", userId });
  };

  socket.onmessage = (msg) => {
    try {
      const data = JSON.parse(String(msg.data)) as RealtimeEvent;
      emit(data);
    } catch {
      /* ignore malformed */
    }
  };

  socket.onclose = () => {
    socket = null;
    // Auto-reconnect with backoff
    window.setTimeout(() => connectRealtime(userId), 2500);
  };

  socket.onerror = () => {
    emit({ type: "error", message: "Realtime socket error" });
  };
}

export function disconnectRealtime() {
  socket?.close();
  socket = null;
}

export function sendRealtime(payload: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

/** Party room chat — WS first; Firebase path documented for optional sync */
export function sendPartyMessage(roomId: string, text: string, userName: string) {
  sendRealtime({
    type: "party_message",
    roomId,
    text,
    userName,
    at: Date.now(),
  });
}

export function sendGiftEvent(input: {
  callId?: string;
  roomId?: string;
  giftId: string;
  coins: number;
  emoji?: string;
}) {
  sendRealtime({ type: "gift", ...input });
}

export function isFirebaseConfigured() {
  return Boolean(env.firebase.apiKey && env.firebase.projectId && env.firebase.appId);
}
