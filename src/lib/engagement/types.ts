export type MissionId =
  | "open_app"
  | "watch_live"
  | "send_gift"
  | "start_call"
  | "follow_host"
  | "spin_once";

export type AchievementId =
  | "first_call"
  | "streak_3"
  | "streak_7"
  | "first_gift"
  | "level_5"
  | "vip_join"
  | "spin_win"
  | "referral_1";

export type Mission = {
  id: MissionId;
  title: string;
  reward: number;
  xp: number;
  icon: string;
  target: number;
};

export type Achievement = {
  id: AchievementId;
  title: string;
  desc: string;
  reward: number;
  icon: string;
};

export type SpinPrize = {
  id: string;
  label: string;
  coins: number;
  weight: number;
  color: string;
};

export type CoinLedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  at: number;
  kind: "credit" | "spend";
};

export type EngagementState = {
  version: 1;
  streak: number;
  lastCheckInDay: string | null;
  checkInClaimedToday: boolean;
  lastSpinDay: string | null;
  spinsToday: number;
  /** Cumulative coins ever won from the Lucky Spin (capped by SPIN_TOTAL_COIN_CAP). */
  spinCoinsTotal: number;
  level: number;
  levelXp: number;
  badges: AchievementId[];
  missionProgress: Record<MissionId, number>;
  missionClaimed: MissionId[];
  weeklyMissionReset: string;
  referralCode: string;
  referralClaims: number;
  freeTrialUsed: boolean;
  freeTrialActive: boolean;
  coinHistory: CoinLedgerEntry[];
  notifyOptIn: boolean;
};
