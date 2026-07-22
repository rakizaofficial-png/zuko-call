"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { listDmThreads, type DmThread } from "@/lib/dmStore";
import { threads, getCreator } from "@/lib/data";

export default function MessagesPage() {
  const [dms, setDms] = useState<DmThread[]>([]);

  useEffect(() => {
    setDms(listDmThreads());
    const onFocus = () => setDms(listDmThreads());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const catalogThreads = threads
    .map((t) => {
      const c = getCreator(t.creatorId);
      if (!c) return null;
      // skip if already have DM thread for same host
      if (dms.some((d) => d.hostId === t.creatorId)) return null;
      return { ...t, creator: c };
    })
    .filter(Boolean) as Array<{
    id: string;
    creatorId: string;
    lastMessage: string;
    time: string;
    unread: number;
    creator: NonNullable<ReturnType<typeof getCreator>>;
  }>;

  const empty = dms.length === 0 && catalogThreads.length === 0;

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <TopBar title="Messages" subtitle="Text hosts anytime." />

      {empty ? (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-line bg-ink-2/50 px-4 py-10 text-center">
          <p className="font-display text-lg font-bold">No chats yet</p>
          <p className="mt-1 text-sm text-muted">
            Tap the paper-plane on a host card to start texting.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-[#ff9f1a] px-4 py-2 text-xs font-bold text-black"
          >
            Browse hosts
          </Link>
        </div>
      ) : (
        <section className="space-y-1 px-3 pb-8">
          {dms.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/messages/${t.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-3 transition active:bg-ink-2"
              >
                <div className="relative">
                  <HostAvatarImg
                    src={t.hostAvatar}
                    hostId={t.hostId}
                    name={t.hostName}
                    alt={t.hostName}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-bold">{t.hostName}</p>
                    <span className="text-[10px] text-muted">
                      {new Date(t.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className={`truncate text-sm ${
                      t.unread ? "font-semibold text-sand" : "text-muted"
                    }`}
                  >
                    {t.lastMessage}
                  </p>
                </div>
                {t.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[10px] font-bold">
                    {t.unread}
                  </span>
                )}
              </Link>
            </motion.div>
          ))}

          {catalogThreads.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (dms.length + i) * 0.04 }}
            >
              <Link
                href={`/messages/${t.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-3 transition active:bg-ink-2"
              >
                <HostAvatarImg
                  src={t.creator.image}
                  hostId={t.creator.id}
                  name={t.creator.name}
                  alt={t.creator.name}
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-bold">{t.creator.name}</p>
                    <span className="text-[10px] text-muted">{t.time}</span>
                  </div>
                  <p
                    className={`truncate text-sm ${
                      t.unread ? "font-semibold text-sand" : "text-muted"
                    }`}
                  >
                    {t.lastMessage}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </section>
      )}
    </main>
  );
}
