"use client";

/**
 * Production App store — wallet from CoinCall APIs + local engagement engine.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { vipTierFromXp, type VipTier } from "@/lib/ledger";
import {
  claimDailyCheckIn,
  claimMission,
  claimReferral,
  markFreeTrialUsed,
  markVipJoined,
  progressMission,
  recordCallComplete,
  recordFollow,
  recordGiftSent,
  recordLiveWatch,
  recordOpenApp,
  setFreeTrialActive,
  setNotifyOptIn,
  spinLuckyWheel,
  canUseFreeTrial,
  getEngagement,
  nextCheckInReward,
  spinsRemaining,
  appendLocalHistory,
  type EngagementState,
  type MissionId,
  type RewardResult,
} from "@/lib/engagement";
import {
  creditCoinsApi,
  fetchOrCreateWallet,
  setPremiumApi,
  spendCoinsApi,
  updateProfileName,
} from "@/lib/walletApi";
import {
  ensureLocalProfile,
  updateLocalDisplayName,
} from "@/lib/userProfile";
import { getRealtimeClient } from "@/lib/realtime/websocket";

type Toast = { id: number; text: string };

type AppStore = {
  ready: boolean;
  userId: string;
  displayName: string;
  avatarUrl: string;
  coins: number;
  xp: number;
  vipTier: VipTier;
  isPremium: boolean;
  following: string[];
  toasts: Toast[];
  engagement: EngagementState;
  refreshEngagement: () => void;
  claimCheckIn: () => Promise<RewardResult>;
  doLuckySpin: () => Promise<RewardResult>;
  claimWeeklyMission: (id: MissionId) => Promise<RewardResult>;
  applyReferral: (code: string) => Promise<RewardResult>;
  completeCallEngagement: () => Promise<void>;
  completeGiftEngagement: () => Promise<void>;
  completeFollowEngagement: (id: string) => void;
  completeLiveWatch: () => void;
  useFreeTrial: () => boolean;
  endFreeTrial: () => void;
  freeTrialAvailable: boolean;
  enablePushOptIn: () => void;
  spend: (amount: number, label?: string) => boolean;
  spendAsync: (amount: number, label?: string) => Promise<boolean>;
  addCoins: (amount: number, label?: string) => void;
  creditReward: (amount: number, label: string) => Promise<void>;
  syncWallet: () => Promise<import("@/lib/walletApi").WalletSnapshot>;
  updateDisplayName: (name: string) => Promise<void>;
  addXp: (amount: number) => void;
  toggleFollow: (id: string) => void;
  setPremium: (v: boolean) => void;
  activatePremium: (planId: string, welcomeCoins: number) => Promise<void>;
  pushToast: (text: string) => void;
  topUpOpen: boolean;
  topUpGrace: number;
  openTopUp: (grace?: number) => void;
  closeTopUp: () => void;
  entranceBlast: boolean;
  entranceReady: boolean;
  triggerEntranceBlast: () => void;
  clearEntranceBlast: () => void;
  coinBurst: number;
  triggerCoinBurst: (amount: number) => void;
};

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Luma Fan");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [isPremium, setPremium] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpGrace, setTopUpGrace] = useState(15);
  const [entranceBlast, setEntranceBlast] = useState(false);
  const [entranceReady, setEntranceReady] = useState(false);
  const [engagement, setEngagement] = useState<EngagementState>(() =>
    typeof window === "undefined" ? getEngagement() : getEngagement(),
  );
  const [coinBurst, setCoinBurst] = useState(0);
  const graceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const vipTier = useMemo(() => vipTierFromXp(xp), [xp]);
  const freeTrialAvailable = !engagement.freeTrialUsed;

  const pushToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  const triggerCoinBurst = useCallback((amount: number) => {
    setCoinBurst(amount);
    setTimeout(() => setCoinBurst(0), 1600);
  }, []);

  const refreshEngagement = useCallback(() => {
    setEngagement(getEngagement());
  }, []);

  const syncWallet = useCallback(async () => {
    const wallet = await fetchOrCreateWallet();
    setUserId(wallet.userId);
    setDisplayName(wallet.displayName || ensureLocalProfile().displayName);
    setAvatarUrl(wallet.avatarUrl || ensureLocalProfile().avatarUrl);
    setCoins(wallet.coinBalance);
    setXp(wallet.xp);
    setPremium(wallet.isPremium);
    return wallet;
  }, []);

  const creditReward = useCallback(
    async (amount: number, label: string) => {
      if (amount <= 0) return;
      try {
        const wallet = await creditCoinsApi({ amount, reason: label });
        setCoins(wallet.coinBalance);
        setXp(wallet.xp);
        appendLocalHistory(amount, label, "credit");
        refreshEngagement();
        triggerCoinBurst(amount);
        pushToast(label);
      } catch {
        pushToast("Reward sync failed — try again");
        try {
          await syncWallet();
        } catch {
          /* ignore */
        }
      }
    },
    [pushToast, refreshEngagement, syncWallet, triggerCoinBurst],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      try {
        const wallet = await updateProfileName(name);
        setDisplayName(wallet.displayName);
        if (wallet.avatarUrl) setAvatarUrl(wallet.avatarUrl);
        pushToast("Profile updated");
      } catch {
        const local = updateLocalDisplayName(name);
        setDisplayName(local.displayName);
        pushToast("Saved on this device");
      }
    },
    [pushToast],
  );

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const local = ensureLocalProfile();
        if (cancelled) return;
        setUserId(local.userId);
        setDisplayName(local.displayName);
        setAvatarUrl(local.avatarUrl);
        setEngagement(recordOpenApp());

        const wallet = await syncWallet();
        if (cancelled) return;
        setReady(true);
        setEntranceReady(true);

        if (wallet.created) {
          pushToast("Profile created · +100 welcome coins");
        }

        const rt = getRealtimeClient(local.userId);
        rt.connect();
        unsub = rt.subscribe((ev) => {
          if (
            ev.type === "wallet:updated" &&
            ev.payload.userId === local.userId
          ) {
            setCoins(ev.payload.coinBalance);
            setXp(ev.payload.xp);
          }
        });
      } catch (e) {
        if (!cancelled) {
          pushToast(
            e instanceof Error
              ? e.message
              : "Wallet API unreachable — check NEXT_PUBLIC_API_BASE_URL",
          );
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      if (graceRef.current) clearInterval(graceRef.current);
    };
  }, [pushToast, syncWallet]);

  const clearEntranceBlast = useCallback(() => setEntranceBlast(false), []);
  const triggerEntranceBlast = useCallback(() => setEntranceBlast(true), []);

  const closeTopUp = useCallback(() => {
    setTopUpOpen(false);
    if (graceRef.current) {
      clearInterval(graceRef.current);
      graceRef.current = null;
    }
  }, []);

  const openTopUp = useCallback((grace = 15) => {
    setTopUpGrace(grace);
    setTopUpOpen(true);
    if (graceRef.current) clearInterval(graceRef.current);
    graceRef.current = setInterval(() => {
      setTopUpGrace((g) => {
        if (g <= 1) {
          if (graceRef.current) clearInterval(graceRef.current);
          graceRef.current = null;
          return 0;
        }
        return g - 1;
      });
    }, 1000);
  }, []);

  const addXp = useCallback((amount: number) => {
    setXp((x) => x + amount);
  }, []);

  const applyReward = useCallback(
    async (result: RewardResult) => {
      setEngagement(result.state);
      if (result.coins > 0) {
        await creditReward(result.coins, result.message);
      } else if (result.message) {
        pushToast(result.message);
      }
      if (result.xp > 0) addXp(result.xp);
      return result;
    },
    [addXp, creditReward, pushToast],
  );

  const claimCheckIn = useCallback(async () => {
    return applyReward(claimDailyCheckIn());
  }, [applyReward]);

  const doLuckySpin = useCallback(async () => {
    return applyReward(spinLuckyWheel());
  }, [applyReward]);

  const claimWeeklyMission = useCallback(
    async (id: MissionId) => {
      return applyReward(claimMission(id));
    },
    [applyReward],
  );

  const applyReferral = useCallback(
    async (code: string) => {
      return applyReward(claimReferral(code));
    },
    [applyReward],
  );

  const completeCallEngagement = useCallback(async () => {
    await applyReward(recordCallComplete());
  }, [applyReward]);

  const completeGiftEngagement = useCallback(async () => {
    await applyReward(recordGiftSent());
  }, [applyReward]);

  const completeFollowEngagement = useCallback((id: string) => {
    void id;
    setEngagement(recordFollow());
  }, []);

  const completeLiveWatch = useCallback(() => {
    setEngagement(recordLiveWatch());
  }, []);

  const useFreeTrial = useCallback(() => {
    if (!canUseFreeTrial()) return false;
    setEngagement(setFreeTrialActive(true));
    return true;
  }, []);

  const endFreeTrial = useCallback(() => {
    setEngagement(markFreeTrialUsed());
  }, []);

  const enablePushOptIn = useCallback(() => {
    setEngagement(setNotifyOptIn(true));
    pushToast("Daily reminders on — we’ll nudge you for rewards");
    if (typeof window !== "undefined" && "Notification" in window) {
      void Notification.requestPermission();
    }
  }, [pushToast]);

  const spendAsync = useCallback(
    async (amount: number, label?: string) => {
      try {
        const wallet = await spendCoinsApi({
          amount,
          reason: label || "spend",
        });
        setCoins(wallet.coinBalance);
        setXp(wallet.xp);
        appendLocalHistory(amount, label || "spend", "spend");
        refreshEngagement();
        if (label) pushToast(label);
        return true;
      } catch {
        openTopUp(15);
        pushToast("Not enough coins — recharge required");
        return false;
      }
    },
    [openTopUp, pushToast, refreshEngagement],
  );

  const spend = useCallback(
    (amount: number, label?: string) => {
      if (coins < amount) {
        openTopUp(15);
        pushToast("Not enough coins — recharge required");
        return false;
      }
      setCoins((c) => c - amount);
      setXp((x) => x + amount);
      appendLocalHistory(amount, label || "spend", "spend");
      refreshEngagement();
      void spendCoinsApi({ amount, reason: label || "spend" }).catch(() => {
        void syncWallet();
        openTopUp(15);
      });
      if (label) pushToast(label);
      return true;
    },
    [coins, openTopUp, pushToast, refreshEngagement, syncWallet],
  );

  const addCoins = useCallback(
    (amount: number, label?: string) => {
      setCoins((c) => c + amount);
      if (label) {
        appendLocalHistory(amount, label, "credit");
        refreshEngagement();
        pushToast(label);
        triggerCoinBurst(amount);
      }
      closeTopUp();
      void syncWallet();
    },
    [closeTopUp, pushToast, refreshEngagement, syncWallet, triggerCoinBurst],
  );

  const toggleFollow = useCallback(
    (id: string) => {
      setFollowing((f) => {
        const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
        if (!f.includes(id)) {
          setEngagement(recordFollow());
        }
        return next;
      });
    },
    [],
  );

  const activatePremium = useCallback(
    async (planId: string, welcomeCoins: number) => {
      try {
        const wallet = await setPremiumApi({ isPremium: true, planId });
        setPremium(true);
        setCoins(wallet.coinBalance);
        setXp(wallet.xp);
      } catch {
        pushToast("VIP activation failed — check connection");
        return;
      }
      if (welcomeCoins > 0) {
        await creditReward(welcomeCoins, `VIP · +${welcomeCoins} welcome coins`);
      }
      await applyReward(markVipJoined());
      triggerEntranceBlast();
      pushToast("Welcome to Luma VIP");
    },
    [applyReward, creditReward, pushToast, triggerEntranceBlast],
  );

  const value = useMemo(
    () => ({
      ready,
      userId,
      displayName,
      avatarUrl,
      coins,
      xp,
      vipTier,
      isPremium,
      following,
      toasts,
      engagement,
      refreshEngagement,
      claimCheckIn,
      doLuckySpin,
      claimWeeklyMission,
      applyReferral,
      completeCallEngagement,
      completeGiftEngagement,
      completeFollowEngagement,
      completeLiveWatch,
      useFreeTrial,
      endFreeTrial,
      freeTrialAvailable,
      enablePushOptIn,
      spend,
      spendAsync,
      addCoins,
      creditReward,
      syncWallet,
      updateDisplayName,
      addXp,
      toggleFollow,
      setPremium,
      activatePremium,
      pushToast,
      topUpOpen,
      topUpGrace,
      openTopUp,
      closeTopUp,
      entranceBlast,
      entranceReady,
      triggerEntranceBlast,
      clearEntranceBlast,
      coinBurst,
      triggerCoinBurst,
    }),
    [
      ready,
      userId,
      displayName,
      avatarUrl,
      coins,
      xp,
      vipTier,
      isPremium,
      following,
      toasts,
      engagement,
      refreshEngagement,
      claimCheckIn,
      doLuckySpin,
      claimWeeklyMission,
      applyReferral,
      completeCallEngagement,
      completeGiftEngagement,
      completeFollowEngagement,
      completeLiveWatch,
      useFreeTrial,
      endFreeTrial,
      freeTrialAvailable,
      enablePushOptIn,
      spend,
      spendAsync,
      addCoins,
      creditReward,
      syncWallet,
      updateDisplayName,
      addXp,
      toggleFollow,
      activatePremium,
      pushToast,
      topUpOpen,
      topUpGrace,
      openTopUp,
      closeTopUp,
      entranceBlast,
      entranceReady,
      triggerEntranceBlast,
      clearEntranceBlast,
      coinBurst,
      triggerCoinBurst,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { nextCheckInReward, spinsRemaining };
