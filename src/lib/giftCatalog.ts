import { requireApiBase } from "@/config/apiConfig";
import { gifts, type Gift } from "@/lib/data";

function giftTierByCoins(coins: number): Gift["tier"] {
  if (coins >= 5000) return "legendary";
  if (coins >= 1000) return "vip";
  if (coins >= 250) return "luxury";
  if (coins >= 100) return "large";
  if (coins >= 40) return "medium";
  return "small";
}

function normalizeGift(raw: Record<string, unknown>): Gift | null {
  const id = String(raw.id || raw.giftId || "").trim();
  const name = String(raw.name || raw.label || "").trim();
  const coins = Number(raw.coins ?? raw.price ?? raw.amount ?? 0);
  if (!id || !name || !Number.isFinite(coins) || coins <= 0) return null;
  return {
    id,
    name,
    emoji: String(raw.emoji || raw.icon || "🎁"),
    coins,
    tier:
      typeof raw.tier === "string"
        ? (raw.tier as Gift["tier"])
        : giftTierByCoins(coins),
  };
}

export async function fetchGiftCatalog(): Promise<Gift[]> {
  try {
    const res = await fetch(`${requireApiBase()}/gifts`, {
      cache: "no-store",
    });
    if (!res.ok) return gifts;
    const data = (await res.json()) as
      | Record<string, unknown>
      | Record<string, unknown>[];
    const source = Array.isArray(data)
      ? data
      : Array.isArray(data.gifts)
        ? (data.gifts as Record<string, unknown>[])
        : Array.isArray(data.catalog)
          ? (data.catalog as Record<string, unknown>[])
          : [];
    const catalog = source
      .map((item) => normalizeGift(item))
      .filter((gift): gift is Gift => Boolean(gift));
    return catalog.length ? catalog : gifts;
  } catch {
    return gifts;
  }
}
