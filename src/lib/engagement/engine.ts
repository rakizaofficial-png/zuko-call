import {
  ACHIEVEMENTS,
  DAILY_LOGIN_COINS,
  MAX_SPINS_PER_DAY,
  SPIN_PRIZES,
  SPIN_TOTAL_COIN_CAP,
  WEEKLY_MISSIONS,
  XP_PER_LEVEL,
} from "./config";
import {
  loadEngagement,
  saveEngagement,
  todayKey,
  yesterdayKey,
} from "./persist";
import type {
  AchievementId,
  CoinLedgerEntry,
  EngagementState,
  MissionId,
  SpinPrize,
} from "./types";

export type RewardResult = {
  state: EngagementState;
  coins: number;
  xp: number;
  message: string;
  prize?: SpinPrize;
  unlocked?: AchievementId[];
};

function pushHistory(
  state: EngagementState,
  amount: number,
  reason: string,
  kind: "credit" | "spend",
): EngagementState {
  const entry: CoinLedgerEntry = {
    id: `lh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    amount,
    reason,
    at: Date.now(),
    kind,
  };
  return {
    ...state,
    coinHistory: [entry, ...state.coinHistory].slice(0, 80),
  };
}

function addLevelXp(state: EngagementState, xp: number): EngagementState {
  let level = state.level;
  let levelXp = state.levelXp + xp;
  while (levelXp >= XP_PER_LEVEL) {
    levelXp -= XP_PER_LEVEL;
    level += 1;
  }
  return { ...state, level, levelXp };
}

function unlockAchievements(
  state: EngagementState,
  ids: AchievementId[],
): { state: EngagementState; coins: number; unlocked: AchievementId[] } {
  let coins = 0;
  const unlocked: AchievementId[] = [];
  let next = state;
  for (const id of ids) {
    if (next.badges.includes(id)) continue;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) continue;
    unlocked.push(id);
    coins += a.reward;
    next = {
      ...next,
      badges: [...next.badges, id],
    };
    next = pushHistory(next, a.reward, `Achievement · ${a.title}`, "credit");
  }
  return { state: next, coins, unlocked };
}

export function getEngagement(): EngagementState {
  return loadEngagement();
}

export function persist(state: EngagementState) {
  saveEngagement(state);
  return state;
}

export function claimDailyCheckIn(opts?: {
  coins?: number;
  fromServer?: boolean;
}): RewardResult {
  let state = loadEngagement();
  const today = todayKey();
  if (
    !opts?.fromServer &&
    state.checkInClaimedToday &&
    state.lastCheckInDay === today
  ) {
    return { state, coins: 0, xp: 0, message: "Already claimed today" };
  }

  let streak = 1;
  if (state.lastCheckInDay === yesterdayKey()) {
    streak = state.streak + 1;
  } else if (state.lastCheckInDay === today) {
    streak = state.streak;
  }

  const coins = opts?.coins ?? DAILY_LOGIN_COINS;
  const xp = 20 + Math.min(streak, 7) * 5;

  state = {
    ...state,
    streak,
    lastCheckInDay: today,
    checkInClaimedToday: true,
  };
  state = addLevelXp(state, xp);
  state = pushHistory(state, coins, `Daily login · +${coins}`, "credit");

  const achIds: AchievementId[] = [];
  if (streak >= 3) achIds.push("streak_3");
  if (streak >= 7) achIds.push("streak_7");
  if (state.level >= 5) achIds.push("level_5");

  const unlocked = unlockAchievements(state, achIds);
  state = unlocked.state;
  // Achievement coins still credited via /wallet/credit separately if needed;
  // daily amount itself comes from server.
  const totalCoins = coins;

  persist(state);
  return {
    state,
    coins: totalCoins,
    xp,
    message: `Daily login · +${totalCoins} coins`,
    unlocked: unlocked.unlocked,
  };
}

function pickPrize(): SpinPrize {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * total;
  for (const p of SPIN_PRIZES) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return SPIN_PRIZES[0]!;
}

/** UI-only preview of wheel segments — server assigns the real prize */
export function previewSpinPrize(): SpinPrize {
  return pickPrize();
}

export function spinLuckyWheel(opts?: {
  coins?: number;
  prize?: SpinPrize;
  fromServer?: boolean;
}): RewardResult {
  let state = loadEngagement();
  const today = todayKey();
  if (state.lastSpinDay !== today) {
    state = { ...state, lastSpinDay: today, spinsToday: 0 };
  }
  if (!opts?.fromServer && state.spinsToday >= MAX_SPINS_PER_DAY) {
    return {
      state,
      coins: 0,
      xp: 0,
      message: "No spins left today — come back tomorrow",
    };
  }
  // Hard cap — never pay out beyond the lifetime spin coin limit.
  const alreadyWon = state.spinCoinsTotal || 0;
  const capRemaining = Math.max(0, SPIN_TOTAL_COIN_CAP - alreadyWon);
  if (capRemaining <= 0) {
    return {
      state,
      coins: 0,
      xp: 0,
      message: "Spin reward limit reached",
    };
  }

  const prize =
    opts?.prize ||
    ({
      id: `c${opts?.coins ?? 30}`,
      label: String(opts?.coins ?? 30),
      coins: opts?.coins ?? 30,
      weight: 1,
      color: "#ffb800",
    } satisfies SpinPrize);

  // Clamp this spin's payout so cumulative spin winnings never exceed the cap.
  const coins = Math.max(0, Math.min(prize.coins, capRemaining));
  const xp = coins > 0 ? 15 : 5;

  state = {
    ...state,
    spinsToday: state.spinsToday + 1,
    lastSpinDay: today,
    spinCoinsTotal: alreadyWon + coins,
  };
  state = bumpMission(state, "spin_once", 1);
  state = addLevelXp(state, xp);
  if (coins > 0) {
    state = pushHistory(state, coins, `Lucky Spin · ${prize.label}`, "credit");
  }

  const achIds: AchievementId[] = [];
  if (coins >= 30) achIds.push("spin_win");
  if (state.level >= 5) achIds.push("level_5");
  const unlocked = unlockAchievements(state, achIds);
  state = unlocked.state;

  persist(state);
  return {
    state,
    coins,
    xp,
    message:
      coins > 0
        ? `You won ${prize.coins} coins!`
        : "So close — spin again tomorrow",
    prize,
    unlocked: unlocked.unlocked,
  };
}

function bumpMission(
  state: EngagementState,
  id: MissionId,
  by = 1,
): EngagementState {
  const mission = WEEKLY_MISSIONS.find((m) => m.id === id);
  if (!mission) return state;
  const cur = state.missionProgress[id] ?? 0;
  return {
    ...state,
    missionProgress: {
      ...state.missionProgress,
      [id]: Math.min(mission.target, cur + by),
    },
  };
}

export function progressMission(id: MissionId, by = 1): EngagementState {
  const state = bumpMission(loadEngagement(), id, by);
  return persist(state);
}

export function claimMission(id: MissionId): RewardResult {
  let state = loadEngagement();
  const mission = WEEKLY_MISSIONS.find((m) => m.id === id);
  if (!mission) {
    return { state, coins: 0, xp: 0, message: "Unknown mission" };
  }
  if (state.missionClaimed.includes(id)) {
    return { state, coins: 0, xp: 0, message: "Already claimed" };
  }
  const progress = state.missionProgress[id] ?? 0;
  if (progress < mission.target) {
    return { state, coins: 0, xp: 0, message: "Mission not complete" };
  }

  state = {
    ...state,
    missionClaimed: [...state.missionClaimed, id],
  };
  state = addLevelXp(state, mission.xp);
  state = pushHistory(state, mission.reward, `Mission · ${mission.title}`, "credit");
  persist(state);
  return {
    state,
    coins: mission.reward,
    xp: mission.xp,
    message: `+${mission.reward} coins · ${mission.title}`,
  };
}

export function markFreeTrialUsed(): EngagementState {
  const state = {
    ...loadEngagement(),
    freeTrialUsed: true,
    freeTrialActive: false,
  };
  return persist(state);
}

export function setFreeTrialActive(active: boolean): EngagementState {
  const state = { ...loadEngagement(), freeTrialActive: active };
  return persist(state);
}

export function canUseFreeTrial(): boolean {
  return !loadEngagement().freeTrialUsed;
}

export function recordCallComplete(): RewardResult {
  let state = progressMission("start_call", 1);
  const unlocked = unlockAchievements(state, ["first_call"]);
  state = unlocked.state;
  if (state.level >= 5) {
    const more = unlockAchievements(state, ["level_5"]);
    state = more.state;
    unlocked.coins += more.coins;
    unlocked.unlocked.push(...more.unlocked);
  }
  persist(state);
  return {
    state,
    coins: unlocked.coins,
    xp: 30,
    message: unlocked.coins
      ? `Call complete · +${unlocked.coins} achievement coins`
      : "Call complete",
    unlocked: unlocked.unlocked,
  };
}

export function recordGiftSent(): RewardResult {
  let state = progressMission("send_gift", 1);
  const unlocked = unlockAchievements(state, ["first_gift"]);
  state = unlocked.state;
  persist(state);
  return {
    state,
    coins: unlocked.coins,
    xp: 10,
    message: unlocked.coins ? `+${unlocked.coins} · first gift badge` : "Gift sent",
    unlocked: unlocked.unlocked,
  };
}

export function recordFollow(): EngagementState {
  return progressMission("follow_host", 1);
}

export function recordLiveWatch(): EngagementState {
  return progressMission("watch_live", 1);
}

export function recordOpenApp(): EngagementState {
  return progressMission("open_app", 1);
}

export function claimReferral(code: string): RewardResult {
  let state = loadEngagement();
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized === state.referralCode) {
    return { state, coins: 0, xp: 0, message: "Enter a friend’s invite code" };
  }
  if (state.referralClaims > 0) {
    return { state, coins: 0, xp: 0, message: "Referral already claimed" };
  }
  // Coins are granted only by POST /api/rewards/referral — never locally.
  state = {
    ...state,
    referralClaims: 1,
  };
  state = addLevelXp(state, 40);
  const unlocked = unlockAchievements(state, ["referral_1"]);
  state = unlocked.state;
  persist(state);
  return {
    state,
    coins: 0,
    xp: 40,
    message: "Invite code saved",
    unlocked: unlocked.unlocked,
  };
}

export function markVipJoined(): RewardResult {
  let state = loadEngagement();
  const unlocked = unlockAchievements(state, ["vip_join"]);
  state = unlocked.state;
  persist(state);
  return {
    state,
    coins: unlocked.coins,
    xp: 50,
    message: unlocked.coins ? `VIP badge · +${unlocked.coins}` : "VIP active",
    unlocked: unlocked.unlocked,
  };
}

export function setNotifyOptIn(v: boolean): EngagementState {
  const state = { ...loadEngagement(), notifyOptIn: v };
  return persist(state);
}

export function appendLocalHistory(
  amount: number,
  reason: string,
  kind: "credit" | "spend",
): EngagementState {
  const state = pushHistory(loadEngagement(), amount, reason, kind);
  return persist(state);
}

export function nextCheckInReward(_state?: EngagementState): number {
  return DAILY_LOGIN_COINS;
}

export function spinsRemaining(state: EngagementState): number {
  const today = todayKey();
  if (state.lastSpinDay !== today) return MAX_SPINS_PER_DAY;
  return Math.max(0, MAX_SPINS_PER_DAY - state.spinsToday);
}

/** Coins still available under the lifetime spin cap. */
export function spinCoinsRemaining(state: EngagementState): number {
  return Math.max(0, SPIN_TOTAL_COIN_CAP - (state.spinCoinsTotal || 0));
}

/** Whether the user may spin now: daily limit not hit AND lifetime cap not reached. */
export function canSpin(state: EngagementState): boolean {
  return spinsRemaining(state) > 0 && spinCoinsRemaining(state) > 0;
}
