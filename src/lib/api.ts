/**
 * Shared CoinCall backend — hosts, calls, wallet, realtime.
 * Base URL from src/config/apiConfig.ts (no hardcoded mocks in callers).
 */

import { apiConfig, requireApiBase } from "@/config/apiConfig";

export const API_BASE_URL = apiConfig.apiBaseUrl;

export type LiveHost = {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  ratePerMinute: number;
  isOnline: boolean;
  isLive: boolean;
  isOnCall: boolean;
  readyToCall?: boolean;
  workspaceMode?: "waiting_1v1" | "solo_calling";
  /** Optional gender for female-only match filter */
  gender?: string;
};

export type BridgeCall = {
  id: string;
  channel: string;
  hostId: string;
  hostName: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  ratePerMinute: number;
  status: "ringing" | "accepted" | "rejected" | "ended" | "missed";
  hostUidAgora: number;
  userUidAgora: number;
};

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export async function fetchLiveHosts(opts?: {
  readyOnly?: boolean;
}): Promise<LiveHost[]> {
  const readyQs = opts?.readyOnly ? "?ready=1" : "";
  const res = await fetch(`${requireApiBase()}/hosts${readyQs}`, {
    cache: "no-store",
  });
  const data = await parse<{ hosts: LiveHost[] }>(res);
  return data.hosts ?? [];
}

/** Single host profile (works even if briefly offline) */
export async function fetchHostProfile(
  hostId: string,
): Promise<LiveHost | null> {
  const id = hostId.trim();
  if (!id) return null;
  try {
    const res = await fetch(
      `${requireApiBase()}/hosts/${encodeURIComponent(id)}/profile`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    const data = await parse<{ host: LiveHost }>(res);
    return data.host ?? null;
  } catch {
    return null;
  }
}

export async function createCall(input: {
  hostId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}): Promise<BridgeCall> {
  const res = await fetch(`${requireApiBase()}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parse<{ call: BridgeCall }>(res);
  return data.call;
}

export async function getCall(callId: string): Promise<BridgeCall> {
  const res = await fetch(`${requireApiBase()}/calls/${callId}`, {
    cache: "no-store",
  });
  const data = await parse<{ call: BridgeCall }>(res);
  return data.call;
}

export async function endCall(callId: string) {
  const res = await fetch(`${requireApiBase()}/calls/${callId}/end`, {
    method: "POST",
  });
  // Idempotent success for already-ended / missing calls
  if (res.ok || res.status === 404 || res.status === 409 || res.status === 410) {
    return;
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error || `End call failed (${res.status})`);
}

export async function fetchCallToken(callId: string) {
  const res = await fetch(
    `${requireApiBase()}/calls/${callId}/token?role=user`,
  );
  return parse<{
    token: string;
    appId: string;
    uid: number;
    channel: string;
    call: BridgeCall;
  }>(res);
}

export async function searchProfileByAppId(appId: string): Promise<{
  userId: string;
  appId: string;
  displayName: string;
  avatarUrl?: string;
  role: "user" | "host";
} | null> {
  const cleaned = appId.trim().replace(/\D/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  const res = await fetch(
    `${requireApiBase()}/profiles/search?appId=${encodeURIComponent(cleaned)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  const data = await parse<{
    profile: {
      userId: string;
      appId: string;
      displayName: string;
      avatarUrl?: string;
      role: "user" | "host";
    };
  }>(res);
  return data.profile;
}

export async function waitForAccept(
  callId: string,
  onTick?: (status: BridgeCall["status"]) => void,
  timeoutMs = 45_000,
): Promise<BridgeCall> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const call = await getCall(callId);
    onTick?.(call.status);
    if (call.status === "accepted") return call;
    if (
      call.status === "rejected" ||
      call.status === "ended" ||
      call.status === "missed"
    ) {
      throw new Error(
        call.status === "rejected"
          ? "Host declined the call"
          : "Host missed the call",
      );
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  throw new Error("Host did not answer");
}
