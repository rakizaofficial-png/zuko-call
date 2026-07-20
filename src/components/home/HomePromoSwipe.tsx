"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PromoSlide } from "@/lib/homeBanners";

/** Compact horizontal swipe promo strip (admin-controlled). */
export function HomePromoSwipe({ promos }: { promos: PromoSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const slides = promos.filter((p) => p.title);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      setActive((i) => {
        const next = (i + 1) % slides.length;
        const el = scroller.current;
        if (el) {
          const child = el.children[next] as HTMLElement | undefined;
          child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        }
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <section className="px-4 pt-3">
      <div
        ref={scroller}
        onScroll={() => {
          const el = scroller.current;
          if (!el) return;
          const w = el.clientWidth || 1;
          setActive(Math.round(el.scrollLeft / w));
        }}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((p) => (
          <Link
            key={p.id}
            href={p.ctaHref || "/"}
            className="relative h-[72px] w-[min(100%,320px)] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 px-3.5 py-2.5 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${p.bgFrom || "#1a1520"}, ${p.bgTo || "#2a2030"})`,
            }}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
              />
            ) : null}
            <div className="relative z-[1] flex h-full flex-col justify-center pr-16">
              <p className="font-display text-[13px] font-bold leading-tight text-sand">
                {p.title}
              </p>
              {p.subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-[10px] text-white/65">
                  {p.subtitle}
                </p>
              ) : null}
            </div>
            <span className="absolute bottom-2.5 right-3 z-[1] rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white">
              {p.ctaLabel || "Open"} →
            </span>
          </Link>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {slides.map((p, i) => (
            <span
              key={p.id}
              className={`h-1 rounded-full transition-all ${
                i === active ? "w-4 bg-coral" : "w-1.5 bg-white/25"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
