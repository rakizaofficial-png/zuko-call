/** Shared CoinCall backend — host presence + Agora tokens + 1v1 signaling */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api';

export type LiveHost = {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  ratePerMinute: number;
  isOnline: boolean;
  isLive: boolean;
  isOnCall: boolean;
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
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  hostUidAgora: number;
  userUidAgora: number;
};

export async function fetchLiveHosts(): Promise<LiveHost[]> {
  const res = await fetch(`${API_BASE_URL}/hosts`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load hosts');
  const data = (await res.json()) as { hosts: LiveHost[] };
  return data.hosts ?? [];
}

export async function createCall(input: {
  hostId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}): Promise<BridgeCall> {
  const res = await fetch(`${API_BASE_URL}/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Call failed');
  return data.call as BridgeCall;
}

export async function getCall(callId: string): Promise<BridgeCall> {
  const res = await fetch(`${API_BASE_URL}/calls/${callId}`, {
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Call not found');
  return data.call as BridgeCall;
}

export async function endCall(callId: string) {
  await fetch(`${API_BASE_URL}/calls/${callId}/end`, { method: 'POST' });
}

export async function fetchCallToken(callId: string) {
  const res = await fetch(`${API_BASE_URL}/calls/${callId}/token?role=user`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token failed');
  return data as {
    token: string;
    appId: string;
    uid: number;
    channel: string;
    call: BridgeCall;
  };
}

export async function waitForAccept(
  callId: string,
  onTick?: (status: BridgeCall['status']) => void,
  timeoutMs = 45_000,
): Promise<BridgeCall> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const call = await getCall(callId);
    onTick?.(call.status);
    if (call.status === 'accepted') return call;
    if (
      call.status === 'rejected' ||
      call.status === 'ended' ||
      call.status === 'missed'
    ) {
      throw new Error(
        call.status === 'rejected'
          ? 'Host declined the call'
          : 'Host missed the call',
      );
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  throw new Error('Host did not answer');
}
