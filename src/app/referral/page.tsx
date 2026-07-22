"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Gift, Share2, Users } from "lucide-react";
import { useApp } from "@/lib/store";

const HISTORY_KEY = "zuko_referral_history_v1";

type RefEvent = { id: string; label: string; coins: number; at: number };

function readHistory(): RefEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RefEvent[]) : [];
  } catch {
    return [];
  }
}

export default function ReferralPage() {
  const { engagement, clientReady, applyReferral, pushToast } = useApp();
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<RefEvent[]>([]);
  const myCode = clientReady ? engagement.referralCode : "······";
  const link = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/referral?invite=${encodeURIComponent(myCode)}`
        : `https://luma-user.onrender.com/referral?invite=${myCode}`,
    [myCode],
  );

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast(ok);
    } catch {
      pushToast(text);
    }
  };

  const invite = async () => {
    const payload = {
      title: "Join Zuko",
      text: `Call with me on Zuko — use my code ${myCode} for free coins!`,
      url: link,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      /* fall through */
    }
    await copy(link, "Invite link copied");
  };

  const claim = async () => {
    await applyReferral(code);
    const next: RefEvent = {
      id: `ref_${Date.now()}`,
      label: `Claimed ${code}`,
      coins: 50,
      at: Date.now(),
    };
    const list = [next, ...readHistory()].slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    setHistory(list);
    setCode("");
  };

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Earn
          </p>
          <h1 className="font-display text-xl font-bold">Invite & earn</h1>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[1.5rem] border border-gold/30 bg-gradient-to-br from-gold/20 via-ink-2 to-ink p-5"
        >
          <Users className="h-6 w-6 text-gold" />
          <h2 className="mt-3 font-display text-lg font-extrabold">
            Share Zuko, earn coins
          </h2>
          <p className="mt-1 text-sm text-muted">
            Friends get a welcome boost. You earn referral coins when they join.
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Your code
          </p>
          <div className="mt-1.5 flex gap-2">
            <code className="flex-1 truncate rounded-2xl bg-ink/70 px-3 py-3 font-display text-xl font-extrabold tracking-widest text-gold">
              {myCode}
            </code>
            <button
              type="button"
              onClick={() => void copy(myCode, "Code copied")}
              className="rounded-2xl bg-ink-3 p-3"
              aria-label="Copy code"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void invite()}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-sm font-bold text-ink"
          >
            <Share2 className="h-4 w-4" />
            Invite friends
          </button>
          <button
            type="button"
            onClick={() => void copy(link, "Referral link copied")}
            className="mt-2 w-full text-center text-xs font-semibold text-cyan"
          >
            Copy referral link
          </button>
        </motion.div>

        <div className="rounded-2xl border border-line bg-ink-2/70 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Gift className="h-4 w-4 text-coral" />
            Enter a friend’s code
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-ink px-3 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void claim()}
              className="shrink-0 rounded-2xl bg-coral px-4 text-xs font-bold text-white"
            >
              Claim
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-ink-2/60 p-4">
          <h3 className="font-display text-sm font-bold">Referral history</h3>
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-ink/50 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold">{h.label}</p>
                  <p className="text-[10px] text-muted">
                    {new Date(h.at).toLocaleString()}
                  </p>
                </div>
                <p className="font-display text-sm font-extrabold text-teal">
                  +{h.coins}
                </p>
              </li>
            ))}
            {!history.length ? (
              <p className="py-4 text-center text-xs text-muted">
                No referral rewards yet
              </p>
            ) : null}
          </ul>
        </div>
      </section>
    </main>
  );
}
