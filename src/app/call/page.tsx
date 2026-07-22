"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Shuffle } from "lucide-react";
import {
  HostGridCard,
  HostGridSkeleton,
} from "@/components/host/PremiumHostCard";
import { TopBar } from "@/components/TopBar";
import { fetchLiveHosts } from "@/lib/api";
import {
  catalogDiscoverHosts,
  mergeDiscoverHosts,
  rotateHosts,
  uniqueHosts,
  type DiscoverHost,
} from "@/lib/discoverHosts";

/** 1v1 Calling — card grid of calling hosts only (not live streamers) */
export default function CallLobbyPage() {
  const [hosts, setHosts] = useState<DiscoverHost[]>([]);
  const [loading, setLoading] = useState(true);
  const sigRef = useRef("");

  const refresh = useCallback(async () => {
    try {
      const all = await fetchLiveHosts();
      const next = uniqueHosts(
        mergeDiscoverHosts(all).filter((h) => h.online && !h.live),
      );
      const sig = next.map((h) => `${h.id}:${h.online ? 1 : 0}`).join("|");
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setHosts(next);
      }
    } catch {
      if (sigRef.current !== "") {
        sigRef.current = "";
        setHosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  // Auto-rotate the calling feed so it never looks static. Start from a fixed
  // seed (SSR-safe, no hydration mismatch); randomize + rotate after mount.
  const [rotationSeed, setRotationSeed] = useState(0);
  useEffect(() => {
    setRotationSeed(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setRotationSeed((s) => s + 1), 15000);
    const onVis = () => {
      if (!document.hidden) setRotationSeed((s) => s + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const displayHosts = useMemo(() => {
    const src = hosts.length ? hosts : catalogDiscoverHosts("call");
    return uniqueHosts(rotateHosts(src, rotationSeed));
  }, [hosts, rotationSeed]);

  return (
    <main className="pb-28">
      <TopBar title="1v1 Calling" subtitle="Private video calls" />

      <div className="flex justify-end px-4 pb-2 pt-1">
        <Link
          href="/match"
          className="inline-flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-[10px] font-bold text-white"
        >
          <Shuffle className="h-3 w-3" /> Match
        </Link>
      </div>

      {loading && !displayHosts.length ? (
        <HostGridSkeleton />
      ) : displayHosts.length === 0 ? (
        <div className="mx-4 mt-2 rounded-2xl border border-dashed border-line bg-ink-2/60 px-4 py-10 text-center text-sm text-muted">
          No calling hosts right now.
          <br />
          <Link href="/live" className="mt-2 inline-block font-bold text-coral">
            Watch Live →
          </Link>
          {" · "}
          <Link href="/match" className="font-bold text-cyan">
            Try Match
          </Link>
        </div>
      ) : (
        <section className="mt-2 grid grid-cols-2 gap-3 px-4 pb-8">
          {displayHosts.map((h, i) => (
            <HostGridCard key={h.id} host={h} mode="call" index={i} />
          ))}
        </section>
      )}
    </main>
  );
}
