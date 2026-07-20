import { fetchLiveHosts, type LiveHost } from "@/lib/api";
import { resolveAiHostForRequest } from "./catalog";
import type { CallRouteDecision } from "./types";

function isAiCatalogId(hostId: string): boolean {
  return /^ai[_-]/i.test(hostId.trim());
}

/**
 * Route a 1:1 call for a specific host id.
 *
 * Explicit user → host calls always prefer Agora live.
 * AI prerecorded is only for `ai_*` catalog ids, or as a last resort
 * when `preferLive` is false and the host is offline/busy.
 */
export async function routeOneToOneCall(
  requestedHostId: string,
  opts?: { preferLive?: boolean },
): Promise<CallRouteDecision> {
  const hostId = requestedHostId.trim();
  const preferLive = opts?.preferLive !== false && !isAiCatalogId(hostId);

  if (isAiCatalogId(hostId)) {
    const aiHost = resolveAiHostForRequest(hostId);
    return {
      transport: "ai_prerecorded",
      reason: "AI catalog host id",
      realHostsOnline: 0,
      aiHost,
      liveHostId: null,
    };
  }

  let hosts: LiveHost[] = [];
  try {
    hosts = await fetchLiveHosts();
  } catch {
    hosts = [];
  }

  const online = hosts.filter((h) => h.isOnline && !h.isOnCall);
  const realHostsOnline = online.length;
  const matched = hosts.find((h) => h.id === hostId) ?? null;

  // Real host online and free → always Agora (no gender gate)
  if (matched?.isOnline && !matched.isOnCall) {
    return {
      transport: "agora_live",
      reason: "Requested host is online — Agora bridge",
      realHostsOnline,
      aiHost: null,
      liveHostId: matched.id,
    };
  }

  // User tapped a real host: ring them (server returns offline/busy). Never swap to AI.
  if (preferLive) {
    return {
      transport: "agora_live",
      reason: matched?.isOnCall
        ? "Host marked busy — still attempting live bridge"
        : "Live bridge for requested host",
      realHostsOnline,
      aiHost: null,
      liveHostId: hostId,
    };
  }

  // Legacy soft fallback (match / non-live flows only)
  const aiHost = resolveAiHostForRequest(hostId);
  return {
    transport: "ai_prerecorded",
    reason: matched?.isOnCall
      ? "Host busy — AI fallback"
      : "Requested host unavailable — AI fallback",
    realHostsOnline,
    aiHost,
    liveHostId: null,
  };
}

/** Random latency 2000–4000ms to mimic server handshake */
export function fakeHandshakeDelayMs(): number {
  return 2000 + Math.floor(Math.random() * 2001);
}
