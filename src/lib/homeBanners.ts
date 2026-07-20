/**
 * Luma home hero + swipe promo banners from CoinCall admin API.
 */

import { requireApiBase } from "@/config/apiConfig";

export type HomeHeroBanner = {
  enabled?: boolean;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
  gradientFrom?: string;
  gradientTo?: string;
};

export type PromoSlide = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  bgFrom?: string;
  bgTo?: string;
};

export type HomeBannersResponse = {
  hero: HomeHeroBanner | null;
  promos: PromoSlide[];
  updatedAt?: number;
};

const FALLBACK: HomeBannersResponse = {
  hero: {
    title: "Meet more friends",
    subtitle: "Live video & 1v1 calls",
    ctaLabel: "Tap to Match",
    ctaHref: "/match",
    gradientFrom: "#ffb020",
    gradientTo: "#ff6b2b",
  },
  promos: [
    {
      id: "promo_coins",
      title: "Coin boost",
      subtitle: "Top up for extra coins",
      ctaLabel: "Wallet",
      ctaHref: "/profile",
      bgFrom: "#2a1a12",
      bgTo: "#5c3a1a",
    },
    {
      id: "promo_vip",
      title: "Go VIP",
      subtitle: "Discounted calls",
      ctaLabel: "VIP",
      ctaHref: "/premium",
      bgFrom: "#1a1528",
      bgTo: "#3d2a5c",
    },
  ],
};

export async function fetchHomeBanners(): Promise<HomeBannersResponse> {
  try {
    const res = await fetch(`${requireApiBase()}/banners/home`, {
      cache: "no-store",
    });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as HomeBannersResponse;
    return {
      hero: data.hero ?? FALLBACK.hero,
      promos: Array.isArray(data.promos) ? data.promos : FALLBACK.promos,
      updatedAt: data.updatedAt,
    };
  } catch {
    return FALLBACK;
  }
}
