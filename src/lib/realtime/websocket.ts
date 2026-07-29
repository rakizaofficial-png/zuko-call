/**
 * =============================================================================
 * REALTIME WEBSOCKET CLIENT
 * =============================================================================
 *
 * SETUP:
 * 1. CoinCall API must expose `/ws` (see server/index.ts WebSocket upgrade).
 * 2. Set NEXT_PUBLIC_WS_URL or rely on apiConfig.wsUrl derivation.
 * 3. Events:
 *    - call:incoming / call:update
 *    - gift:received
 *    - party:message / party:seat
 *    - wallet:updated
 *
 * Replaces mock intervals for live gifting + party chat sync.
 * =============================================================================
 */

import { apiConfig } from "@/config/apiConfig";

export type RealtimeEvent =
  | { type: "connected"; payload: { userId: string } }
  | { type: "call:ended"; payload: { id?: string; status?: string } & Record<string, unknown> }
  | { type: "call:incoming"; payload: Record<string, unknown> }
  | { type: "call:update"; payload: Record<string, unknown> }
  | {
      type: "gift:received";
      payload: {
        roomId?: string | null;
        fromUserId: string;
        fromName?: string;
        toHostId?: string;
        giftId: string;
        giftName?: string;
        giftEmoji?: string;
        coins: number;
        label?: string;
        animationUrl?: string;
        soundUrl?: string;
      };
    }
  | {
      type: "live:comment";
      payload: {
        roomId: string;
        comment: {
          id: string;
          userId: string;
          userName: string;
          text: string;
          createdAt: number;
          kind: string;
          giftEmoji?: string;
          giftCoins?: number;
        };
      };
    }
  | {
      type: "live:viewers";
      payload: { roomId: string; viewers: number };
    }
  | {
      type: "live:room";
      payload: Record<string, unknown>;
    }
  | {
      type: "live:lock";
      payload: {
        id?: string;
        roomId?: string;
        hostId?: string;
        channel?: string;
        entryLocked: boolean;
        entryFee: number;
        updatedAt?: number;
      };
    }
  | {
      type: "live:ended";
      payload: { id: string };
    }
  | {
      type: "dm:message";
      payload: {
        chatId?: string;
        message?: {
          id: string;
          fromId: string;
          toId: string;
          text: string;
          createdAt: number;
          fromName?: string;
        };
        thread?: {
          userId?: string;
          hostId?: string;
          lastMessage?: string;
        };
      };
    }
  | {
      type: "party:message";
      payload: { roomId: string; userId: string; text: string; at: number };
    }
  | {
      type: "party:seat";
      payload: { roomId: string; seats: unknown[] };
    }
  | {
      type: "wallet:updated";
      payload: { userId: string; coinBalance: number; xp: number };
    }
  | { type: "ping"; payload?: unknown };

type Handler = (event: RealtimeEvent) => void;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string;
  private displayName: string;
  private avatarUrl: string;
  private closedByUser = false;

  constructor(
    userId: string,
    opts?: { displayName?: string; avatarUrl?: string },
  ) {
    this.userId = userId;
    this.displayName = opts?.displayName || "User";
    this.avatarUrl = opts?.avatarUrl || "";
  }

  setProfile(opts: { displayName?: string; avatarUrl?: string }) {
    if (opts.displayName) this.displayName = opts.displayName;
    if (opts.avatarUrl !== undefined) this.avatarUrl = opts.avatarUrl;
  }

  subscribe(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  connect() {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const qs = new URLSearchParams({
      userId: this.userId,
      name: this.displayName,
      role: "user",
    });
    if (this.avatarUrl) qs.set("avatar", this.avatarUrl);
    const url = `${apiConfig.wsUrl}?${qs.toString()}`;
    // Explicit logging so native/mobile handshake failures are debuggable
    // (visible in Metro / logcat / WebView remote console). This is the #1
    // clue when calls work on web but the mobile socket never connects.
    console.log(`[realtime] connecting → ${apiConfig.wsUrl}`);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[realtime] connected (userId=${this.userId})`);
      this.emit({ type: "connected", payload: { userId: this.userId } });
      ws.send(
        JSON.stringify({
          type: "hello",
          userId: this.userId,
          payload: {
            name: this.displayName,
            userName: this.displayName,
            avatarUrl: this.avatarUrl,
          },
        }),
      );
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as RealtimeEvent;
        this.emit(data);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = (ev) => {
      console.warn(
        `[realtime] closed (code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ""}) url=${apiConfig.wsUrl}`,
      );
      this.ws = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };

    ws.onerror = () => {
      // Most common on mobile: unreachable host (localhost vs 10.0.2.2) or
      // blocked cleartext traffic. Surface the target URL to diagnose. Use
      // warn (not error) — this is expected/handled and auto-reconnects, so it
      // shouldn't trip the dev error overlay.
      console.warn(
        `[realtime] connect_error — could not reach ${apiConfig.wsUrl}. ` +
          `On Android emulator the backend must be reachable (e.g. 10.0.2.2), ` +
          `and cleartext http must be allowed.`,
      );
      ws.close();
    };
  }

  send(type: string, payload: Record<string, unknown> = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  joinPartyRoom(roomId: string) {
    this.send("party:join", { roomId, userId: this.userId });
  }

  sendPartyMessage(roomId: string, text: string) {
    this.send("party:message", { roomId, userId: this.userId, text });
  }

  sendGift(input: {
    roomId?: string;
    toHostId?: string;
    giftId: string;
    coins: number;
    label: string;
  }) {
    this.send("gift:send", { ...input, fromUserId: this.userId });
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    console.log("[realtime] scheduling reconnect in 2.5s…");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private emit(event: RealtimeEvent) {
    for (const h of this.handlers) h(event);
  }
}

let singleton: RealtimeClient | null = null;

export function getRealtimeClient(
  userId: string,
  opts?: { displayName?: string; avatarUrl?: string },
) {
  if (!singleton || (singleton as unknown as { userId: string }).userId !== userId) {
    singleton?.disconnect();
    singleton = new RealtimeClient(userId, opts);
  } else if (opts) {
    singleton.setProfile(opts);
  }
  return singleton;
}
