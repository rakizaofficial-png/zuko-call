/** Host downtime activity shown on TikTok discovery cards */
export type HostActivityMode = "solo" | "party_room" | "pk_battle";

export type FeedActivity = {
  mode: HostActivityMode;
  label: string;
  seats?: number;
  viewers?: number;
  pkScore?: string;
};

/** Deterministic mock activity from host id so UI stays stable across swipes */
export function resolveHostActivity(
  hostId: string,
  flags?: { isLive?: boolean; isOnCall?: boolean },
): FeedActivity {
  if (flags?.isOnCall) {
    return { mode: "solo", label: "On private call", viewers: 0 };
  }
  let hash = 0;
  for (let i = 0; i < hostId.length; i++) {
    hash = (hash + hostId.charCodeAt(i) * (i + 3)) % 97;
  }
  const bucket = hash % 5;
  if (bucket === 0 || bucket === 1) {
    return {
      mode: "party_room",
      label: "Party Room live",
      seats: 4 + (hash % 3),
      viewers: 120 + (hash % 40) * 7,
    };
  }
  if (bucket === 2) {
    return {
      mode: "pk_battle",
      label: "PK Battle Arena",
      viewers: 80 + (hash % 30) * 5,
      pkScore: `${420 + hash} vs ${380 + (hash % 50)}`,
    };
  }
  return {
    mode: "solo",
    label: flags?.isLive ? "Solo live · waiting" : "Online · waiting 1v1",
    viewers: flags?.isLive ? 40 + (hash % 20) : undefined,
  };
}

export const PREMIUM_TOPUP_TIERS = [
  {
    id: "boost",
    name: "Instant Boost",
    coins: 500,
    price: "$4.99",
    tag: "Fast fill",
    accent: "cyan" as const,
  },
  {
    id: "lounge",
    name: "Lounge Pack",
    coins: 1200,
    bonus: 200,
    price: "$9.99",
    tag: "Most loved",
    accent: "coral" as const,
  },
  {
    id: "elite",
    name: "Elite Vault",
    coins: 2500,
    bonus: 500,
    price: "$19.99",
    tag: "Best value",
    accent: "gold" as const,
  },
] as const;
