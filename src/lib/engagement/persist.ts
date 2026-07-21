import type { EngagementState, MissionId } from "./types";

const KEY = "luma_engagement_v1";

function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function makeReferralCode() {
  const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LUMA${seed}`;
}

/**
 * Deterministic empty state for SSR + first client paint.
 * Never read localStorage or Math.random here — avoids hydration mismatches.
 */
export function emptyEngagement(): EngagementState {
  const missions: Record<MissionId, number> = {
    open_app: 0,
    watch_live: 0,
    send_gift: 0,
    start_call: 0,
    follow_host: 0,
    spin_once: 0,
  };
  return {
    version: 1,
    streak: 0,
    lastCheckInDay: null,
    checkInClaimedToday: false,
    lastSpinDay: null,
    spinsToday: 0,
    spinCoinsTotal: 0,
    level: 1,
    levelXp: 0,
    badges: [],
    missionProgress: missions,
    missionClaimed: [],
    weeklyMissionReset: "1970-W01",
    referralCode: "LUMA------",
    referralClaims: 0,
    freeTrialUsed: false,
    freeTrialActive: false,
    coinHistory: [],
    notifyOptIn: false,
  };
}

export function loadEngagement(): EngagementState {
  if (typeof window === "undefined") return emptyEngagement();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = {
        ...emptyEngagement(),
        referralCode: makeReferralCode(),
        weeklyMissionReset: weekKey(),
      };
      saveEngagement(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as EngagementState;
    const state = { ...emptyEngagement(), ...parsed, version: 1 as const };
    const wk = weekKey();
    if (state.weeklyMissionReset !== wk) {
      state.weeklyMissionReset = wk;
      state.missionProgress = emptyEngagement().missionProgress;
      state.missionClaimed = [];
    }
    const today = todayKey();
    if (state.lastCheckInDay !== today) {
      state.checkInClaimedToday = false;
    }
    if (state.lastSpinDay !== today) {
      state.spinsToday = 0;
      state.lastSpinDay = today;
    }
    return state;
  } catch {
    return emptyEngagement();
  }
}

export function saveEngagement(state: EngagementState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
