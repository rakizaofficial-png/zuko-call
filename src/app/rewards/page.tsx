"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Copy,
  Flame,
  Sparkles,
  Trophy,
} from "lucide-react";
import { DailyCheckInModal } from "@/components/engagement/DailyCheckInModal";
import { LuckySpinModal } from "@/components/engagement/LuckySpinModal";
import {
  ACHIEVEMENTS,
  WEEKLY_MISSIONS,
  XP_PER_LEVEL,
} from "@/lib/engagement";
import { useApp } from "@/lib/store";

export default function RewardsPage() {
  const {
    engagement,
    clientReady,
    claimWeeklyMission,
    applyReferral,
    enablePushOptIn,
    pushToast,
  } = useApp();
  const [spinOpen, setSpinOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [refCode, setRefCode] = useState("");

  const level = clientReady ? engagement.level : 1;
  const levelXp = clientReady ? engagement.levelXp : 0;
  const streak = clientReady ? engagement.streak : 0;

  return (
    <main className="pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/80 px-4 pb-3 backdrop-blur-xl">
        <Link href="/" className="rounded-full bg-ink-3 p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-coral">
            Engagement
          </p>
          <h1 className="font-display text-xl font-bold">Rewards Hub</h1>
        </div>
      </header>

      <section className="space-y-3 px-4 pb-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-extrabold">
              Level {level}
            </p>
            <p className="text-xs text-cyan">
              {levelXp}/{XP_PER_LEVEL} XP
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-coral to-gold"
              style={{
                width: `${(levelXp / XP_PER_LEVEL) * 100}%`,
              }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted">
            <Flame className="h-3.5 w-3.5 text-coral" />
            {streak}-day streak
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="glass-card rounded-2xl p-3.5 text-left"
          >
            <Flame className="h-5 w-5 text-coral" />
            <p className="mt-2 font-display text-sm font-bold">Daily check-in</p>
            <p className="text-[10px] text-muted">Claim today’s coins</p>
          </button>
          <button
            type="button"
            onClick={() => setSpinOpen(true)}
            className="glass-card rounded-2xl p-3.5 text-left"
          >
            <Sparkles className="h-5 w-5 text-gold" />
            <p className="mt-2 font-display text-sm font-bold">Lucky Spin</p>
            <p className="text-[10px] text-muted">Up to 500 coins</p>
          </button>
        </div>

        <button
          type="button"
          onClick={enablePushOptIn}
          className="glass-card flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
        >
          <Bell className="h-5 w-5 text-cyan" />
          <span>
            <span className="block font-display text-sm font-bold">
              Push reminders
            </span>
            <span className="text-[11px] text-muted">
              {engagement.notifyOptIn
                ? "Enabled — we’ll nudge you for rewards"
                : "Enable daily reward & streak alerts"}
            </span>
          </span>
        </button>
      </section>

      <section className="px-4 pb-5">
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted">
          Weekly missions
        </h2>
        <ul className="space-y-2">
          {WEEKLY_MISSIONS.map((m) => {
            const progress = engagement.missionProgress[m.id] ?? 0;
            const done = progress >= m.target;
            const claimed = engagement.missionClaimed.includes(m.id);
            return (
              <li
                key={m.id}
                className="glass-card flex items-center gap-3 rounded-2xl p-3"
              >
                <span className="text-xl">{m.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{m.title}</p>
                  <p className="text-[10px] text-muted">
                    {progress}/{m.target} · +{m.reward} coins
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!done || claimed}
                  onClick={() => void claimWeeklyMission(m.id)}
                  className="rounded-full bg-coral px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {claimed ? "Done" : done ? "Claim" : "Open"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 pb-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted">
          <Trophy className="h-4 w-4" /> Achievements
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = engagement.badges.includes(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-2xl border p-3 ${
                  unlocked
                    ? "border-gold/40 bg-gold/10"
                    : "border-line bg-ink-2/60 opacity-70"
                }`}
              >
                <p className="text-lg">{a.icon}</p>
                <p className="mt-1 text-xs font-bold">{a.title}</p>
                <p className="text-[10px] text-muted">{a.desc}</p>
                {unlocked ? (
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-gold">
                    <CheckCircle2 className="h-3 w-3" /> Unlocked
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-muted">+{a.reward} coins</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 pb-10">
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted">
          Referral program
        </h2>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-muted">Your invite code</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-ink-3 px-3 py-2 font-display text-lg font-extrabold tracking-widest text-gold">
              {engagement.referralCode}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(engagement.referralCode);
                pushToast("Invite code copied");
              }}
              className="rounded-xl bg-ink-3 p-2.5"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Enter a friend’s code</p>
          <div className="mt-2 flex gap-2">
            <input
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="LUMA••••"
              className="flex-1 rounded-xl border border-line bg-ink-3 px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void applyReferral(refCode)}
              className="rounded-xl bg-coral px-4 py-2 text-xs font-bold text-white"
            >
              Claim
            </button>
          </div>
        </div>
      </section>

      <LuckySpinModal open={spinOpen} onClose={() => setSpinOpen(false)} />
      <DailyCheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
      />
    </main>
  );
}
