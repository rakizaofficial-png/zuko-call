"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, LifeBuoy, Pin, Search } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import {
  listDmThreads,
  subscribeUnread,
  type DmThread,
} from "@/lib/dmStore";
import { getSupportMessages } from "@/lib/supportApi";

/** WhatsApp-style pinned official rows — always first, never reorder. */
const PINNED = [
  {
    id: "support",
    href: "/support",
    title: "Customer Support",
    preview: "Tap for help with recharge, calls & account",
    icon: "support" as const,
    verified: true,
  },
  {
    id: "system",
    href: "/messages/system",
    title: "System Information",
    preview: "Official Zuko updates & announcements",
    icon: "system" as const,
    verified: true,
  },
] as const;

function PinnedAvatar({ kind }: { kind: "support" | "system" }) {
  return (
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-full ${
        kind === "support"
          ? "bg-gradient-to-br from-cyan/40 to-teal/20 text-cyan"
          : "bg-gradient-to-br from-gold/40 to-coral/20 text-gold"
      }`}
    >
      {kind === "support" ? (
        <LifeBuoy className="h-7 w-7" />
      ) : (
        <BadgeCheck className="h-7 w-7" />
      )}
    </span>
  );
}

export default function MessagesPage() {
  const [dms, setDms] = useState<DmThread[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => {
      setDms(listDmThreads());
      const msgs = getSupportMessages();
      const last = msgs[msgs.length - 1];
      setSupportUnread(last && last.from === "admin" ? 1 : 0);
    };
    refresh();
    const off = subscribeUnread(refresh);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      off();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filtered = dms.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.hostName.toLowerCase().includes(q) ||
      t.lastMessage.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <TopBar title="Chats" subtitle="Messages" />

      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-2/80 px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
          />
        </label>
      </div>

      {/* Pinned — always first */}
      <section className="px-3 pb-1">
        <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Pin className="h-3 w-3" /> Pinned
        </p>
        {PINNED.map((row, i) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              href={row.href}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-2 py-3 transition active:bg-ink-2"
            >
              <div className="relative">
                <PinnedAvatar kind={row.icon} />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink ring-2 ring-ink">
                  <BadgeCheck className="h-3.5 w-3.5 text-cyan" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-display font-bold">{row.title}</p>
                  {row.verified ? (
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-cyan" />
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted">{row.preview}</p>
              </div>
              {row.id === "support" && supportUnread > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-black">
                  {supportUnread}
                </span>
              ) : (
                <Pin className="h-3.5 w-3.5 shrink-0 text-white/25" />
              )}
            </Link>
          </motion.div>
        ))}
      </section>

      <section className="mt-2 space-y-0.5 px-3 pb-8">
        <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">
          Hosts
        </p>
        {filtered.length === 0 ? (
          <div className="mx-1 mt-4 rounded-2xl border border-dashed border-line bg-ink-2/50 px-4 py-10 text-center">
            <p className="font-display text-lg font-bold">No host chats yet</p>
            <p className="mt-1 text-sm text-muted">
              Open a host profile and tap Message to start chatting.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-black"
            >
              Browse hosts
            </Link>
          </div>
        ) : (
          filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.03 }}
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
                  <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-[#25D366]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display font-bold">
                      {t.hostName}
                    </p>
                    <span
                      className={`shrink-0 text-[10px] ${
                        t.unread ? "font-bold text-[#25D366]" : "text-muted"
                      }`}
                    >
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
                    {t.lastMessage || "Tap to chat"}
                  </p>
                </div>
                {t.unread > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-black">
                    {t.unread > 99 ? "99+" : t.unread}
                  </span>
                ) : null}
              </Link>
            </motion.div>
          ))
        )}
      </section>
    </main>
  );
}
