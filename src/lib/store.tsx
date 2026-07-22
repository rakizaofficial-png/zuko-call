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
  getFollowing,
  setFollowingList,
  toggleFollowLocal,
} from "@/lib/socialLists";
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
  canSpin,
  canUseFreeTrial,
  getEngagement,
  emptyEngagement,
  nextCheckInReward,
  spinsRemaining,
  appendLocalHistory,
  type EngagementState,
  type MissionId,
  type RewardResult,
} from "@/lib/engagement";
import {
  fetchOrCreateWallet,
  setPremiumApi,
  spendCoinsApi,
  updateProfileAvatar,
  updateProfileBio,
  updateProfileName,
  uploadProfileAvatar,
} from "@/lib/walletApi";
import {
  claimDailyRewardApi,
  claimReferralRewardApi,
  claimSpinRewardApi,
} from "@/lib/rewardsApi";
import { WELCOME_BONUS_COINS } from "@/lib/engagement/config";
import {
  ensureLocalProfile,
  updateLocalAvatar,
  updateLocalBio,
  updateLocalDisplayName,
} from "@/lib/userProfile";
import { getRealtimeClient } from "@/lib/realtime/websocket";
import { pushRecentHost } from "@/lib/autoCallApi";
import {
  hasCompletedTx,
  markTxCompleted,
  markTxFailed,
  markTxRolledBack,
  recordPendingTx,
  spendTxId,
  type CoinTxType,
} from "@/lib/coinLedger";

type Toast = { id: string; text: string };

type AppStore = {
  ready: boolean;
  /** False until after first client mount — use for SSR-safe UI */
  clientReady: boolean;
  userId: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
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
  spend: (amount: number, label?: string, meta?: { type?: CoinTxType; hostId?: string; callId?: string; giftId?: string; clientTxId?: string }) => boolean;
  spendAsync: (amount: number, label?: string, meta?: { type?: CoinTxType; hostId?: string; callId?: string; giftId?: string; clientTxId?: string }) => Promise<boolean>;
  addCoins: (amount: number, label?: string) => void;
  creditReward: (amount: number, label: string) => Promise<void>;
  syncWallet: () => Promise<import("@/lib/walletApi").WalletSnapshot>;
  /** Update on-screen balance without Express (Firebase per-minute billing). */
  applyLocalCoins: (balance: number) => void;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  uploadGalleryAvatar: (
    dataUrl: string,
    onProgress?: (pct: number) => void,
  ) => Promise<void>;
  addXp: (amount: number) => void;
  toggleFollow: (id: string) => void;
  setPremium: (v: boolean) => void;
  activatePremium: (planId: string, welcomeCoins: number) => Promise<void>;
  pushToast: (text: string) => void;
  topUpOpen: boolean;
  topUpGrace: number;
  topUpWarning: string | null;
  openTopUp: (grace?: number, warning?: string | null) => void;
  closeTopUp: () => void;
  entranceBlast: boolean;
  entranceReady: boolean;
  triggerEntranceBlast: () => void;
  clearEntranceBlast: () => void;
  coinBurst: number;
  triggerCoinBurst: (amount: number) => void;
};

const Ctx = createContext<AppStore | null>(null);

let toastSeq = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Luma Fan");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [isPremium, setPremium] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);

  useEffect(() => {
    setFollowing(getFollowing());
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpGrace, setTopUpGrace] = useState(15);
  const [topUpWarning, setTopUpWarning] = useState<string | null>(null);
  const [entranceBlast, setEntranceBlast] = useState(false);
  const [entranceReady, setEntranceReady] = useState(false);
  // Always start with deterministic SSR defaults — never read localStorage here
  const [engagement, setEngagement] = useState<EngagementState>(() =>
    emptyEngagement(),
  );
  const [clientReady, setClientReady] = useState(false);
  const [coinBurst, setCoinBurst] = useState(0);
  const graceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const vipTier = useMemo(() => vipTierFromXp(xp), [xp]);
  const freeTrialAvailable = !engagement.freeTrialUsed;

  const pushToast = useCallback((text: string) => {
    const id = `${Date.now()}-${++toastSeq}`;
    // Defer so we never setState on AppProvider during another component's render
    queueMicrotask(() => {
      setToasts((t) => [...t, { id, text }]);
    });
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

  // Load localStorage engagement only after mount (SSR-safe)
  useEffect(() => {
    setEngagement(getEngagement());
    setClientReady(true);
  }, []);

  const syncWallet = useCallback(async () => {
    const wallet = await fetchOrCreateWallet();
    const local = ensureLocalProfile();
    setUserId(wallet.userId || local.userId);
    const name =
      wallet.displayName?.trim() && wallet.displayName !== "Luma Fan"
        ? wallet.displayName
        : local.displayName;
    setDisplayName(name);
    setAvatarUrl(wallet.avatarUrl || local.avatarUrl);
    setBio(wallet.bio ?? local.bio ?? "");
    setCoins(wallet.coinBalance);
    setXp(wallet.xp);
    setPremium(wallet.isPremium);
    return wallet;
  }, []);

  const applyLocalCoins = useCallback((balance: number) => {
    setCoins(Math.max(0, Math.floor(balance)));
  }, []);

  /** Local UI only — never mints coins. Server is the only authority. */
  const creditReward = useCallback(
    async (amount: number, label: string) => {
      if (amount <= 0) {
        if (label) pushToast(label);
        return;
      }
      // Client mint path closed — resync authoritative balance instead.
      appendLocalHistory(0, `${label} (pending server)`, "credit");
      pushToast(label);
      try {
        await syncWallet();
      } catch {
        /* ignore */
      }
      refreshEngagement();
    },
    [pushToast, refreshEngagement, syncWallet],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      try {
        const wallet = await updateProfileName(name);
        setDisplayName(wallet.displayName);
        if (wallet.avatarUrl) setAvatarUrl(wallet.avatarUrl);
        getRealtimeClient(wallet.userId || userId, {
          displayName: wallet.displayName,
          avatarUrl: wallet.avatarUrl || avatarUrl,
        });
        pushToast("Profile updated");
      } catch {
        const local = updateLocalDisplayName(name);
        setDisplayName(local.displayName);
        getRealtimeClient(local.userId, {
          displayName: local.displayName,
          avatarUrl: local.avatarUrl,
        });
        pushToast("Saved on this device");
      }
    },
    [avatarUrl, pushToast, userId],
  );

  const updateAvatar = useCallback(
    async (nextAvatar: string) => {
      try {
        const wallet = await updateProfileAvatar(nextAvatar);
        setAvatarUrl(wallet.avatarUrl || nextAvatar);
        if (wallet.displayName) setDisplayName(wallet.displayName);
        if (wallet.bio != null) setBio(wallet.bio);
        getRealtimeClient(wallet.userId || userId, {
          displayName: wallet.displayName || displayName,
          avatarUrl: wallet.avatarUrl || nextAvatar,
        });
        pushToast("Photo updated");
      } catch {
        const local = updateLocalAvatar(nextAvatar);
        setAvatarUrl(local.avatarUrl);
        getRealtimeClient(local.userId, {
          displayName: local.displayName,
          avatarUrl: local.avatarUrl,
        });
        pushToast("Saved on this device");
      }
    },
    [displayName, pushToast, userId],
  );

  const updateBio = useCallback(
    async (nextBio: string) => {
      try {
        const wallet = await updateProfileBio(nextBio);
        setBio(wallet.bio ?? nextBio);
        pushToast("Bio updated");
      } catch {
        const local = updateLocalBio(nextBio);
        setBio(local.bio || "");
        pushToast("Saved on this device");
      }
    },
    [pushToast],
  );

  const uploadGalleryAvatar = useCallback(
    async (dataUrl: string, onProgress?: (pct: number) => void) => {
      const wallet = await uploadProfileAvatar(dataUrl, onProgress);
      setAvatarUrl(wallet.avatarUrl || "");
      if (wallet.displayName) setDisplayName(wallet.displayName);
      if (wallet.bio != null) setBio(wallet.bio);
      getRealtimeClient(wallet.userId || userId, {
        displayName: wallet.displayName || displayName,
        avatarUrl: wallet.avatarUrl || "",
      });
      pushToast("Photo saved");
    },
    [displayName, pushToast, userId],
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
        setBio(local.bio || "");
        setEngagement(recordOpenApp());

        const wallet = await syncWallet();
        if (cancelled) return;
        setReady(true);
        setEntranceReady(true);

        if (wallet.welcomeBonus) {
          pushToast(`Profile created · +${WELCOME_BONUS_COINS} welcome coins`);
        }

        const name =
          wallet.displayName?.trim() && wallet.displayName !== "Luma Fan"
            ? wallet.displayName
            : local.displayName;
        const avatar = wallet.avatarUrl || local.avatarUrl;
        const rt = getRealtimeClient(local.userId, {
          displayName: name,
          avatarUrl: avatar,
        });
        rt.connect();
        unsub = rt.subscribe((ev) => {
          // Global incoming-call listener registered at the app root so the
          // mobile app actively listens for call triggers just like web.
          if (ev.type === "call:incoming" || ev.type === "call:update") {
            console.log(`[realtime] ${ev.type}`, ev.payload);
          }
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
    setTopUpWarning(null);
    if (graceRef.current) {
      clearInterval(graceRef.current);
      graceRef.current = null;
    }
  }, []);

  const openTopUp = useCallback((grace = 15, warning: string | null = null) => {
    setTopUpGrace(grace);
    setTopUpWarning(warning);
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
    try {
      const data = await claimDailyRewardApi();
      setCoins(data.wallet.coinBalance);
      setXp(data.wallet.xp);
      const result = claimDailyCheckIn({
        coins: data.coins,
        fromServer: true,
      });
      setEngagement(result.state);
      triggerCoinBurst(data.coins);
      pushToast(data.reason || result.message);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Daily reward unavailable";
      pushToast(msg);
      return {
        state: getEngagement(),
        coins: 0,
        xp: 0,
        message: msg,
      };
    }
  }, [pushToast, triggerCoinBurst]);

  const doLuckySpin = useCallback(async () => {
    // Enforce the spin limits BEFORE hitting the server so no extra coins are
    // ever granted once the daily limit or lifetime cap is reached.
    const eng = getEngagement();
    if (!canSpin(eng)) {
      const msg =
        spinsRemaining(eng) <= 0
          ? "No spins left today — come back tomorrow"
          : "Spin reward limit reached";
      pushToast(msg);
      return { state: eng, coins: 0, xp: 0, message: msg };
    }
    try {
      const data = await claimSpinRewardApi();
      setCoins(data.wallet.coinBalance);
      setXp(data.wallet.xp);
      const result = spinLuckyWheel({
        coins: data.coins,
        prize: data.prize,
        fromServer: true,
      });
      setEngagement(result.state);
      triggerCoinBurst(data.coins);
      pushToast(result.message);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Spin unavailable";
      pushToast(msg);
      return {
        state: getEngagement(),
        coins: 0,
        xp: 0,
        message: msg,
      };
    }
  }, [pushToast, triggerCoinBurst]);

  const claimWeeklyMission = useCallback(
    async (id: MissionId) => {
      return applyReward(claimMission(id));
    },
    [applyReward],
  );

  const applyReferral = useCallback(
    async (code: string) => {
      try {
        const data = await claimReferralRewardApi(code);
        setCoins(data.wallet.coinBalance);
        setXp(data.wallet.xp);
        const local = claimReferral(code);
        setEngagement(local.state);
        if (data.coins > 0) {
          triggerCoinBurst(data.coins);
          pushToast(data.reason || `Referral · +${data.coins}`);
        } else {
          pushToast(data.reason || local.message);
        }
        return {
          state: local.state,
          coins: data.coins,
          xp: local.xp,
          message: data.reason || local.message,
        };
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Referral unavailable";
        // Keep local badge/XP if server referral is disabled
        if (/disabled/i.test(msg)) {
          return applyReward(claimReferral(code));
        }
        pushToast(msg);
        return {
          state: getEngagement(),
          coins: 0,
          xp: 0,
          message: msg,
        };
      }
    },
    [applyReward, pushToast, triggerCoinBurst],
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
    async (
      amount: number,
      label?: string,
      meta?: {
        type?: CoinTxType;
        hostId?: string;
        callId?: string;
        giftId?: string;
        clientTxId?: string;
      },
    ) => {
      const txId = meta?.clientTxId ?? spendTxId(label || "spend");
      if (hasCompletedTx(txId)) {
        await syncWallet();
        return true;
      }
      recordPendingTx({
        id: txId,
        userId,
        amount,
        type: meta?.type ?? "spend",
        reason: label || "spend",
        hostId: meta?.hostId,
        callId: meta?.callId,
        giftId: meta?.giftId,
      });
      try {
        const wallet = await spendCoinsApi({
          amount,
          reason: label || "spend",
          clientTxId: txId,
          meta: {
            hostId: meta?.hostId,
            callId: meta?.callId,
            giftId: meta?.giftId,
            type: meta?.type,
          },
        });
        setCoins(wallet.coinBalance);
        setXp(wallet.xp);
        markTxCompleted(txId, { serverId: wallet.transactionId });
        appendLocalHistory(amount, label || "spend", "spend");
        refreshEngagement();
        if (label) pushToast(label);
        return true;
      } catch (e) {
        markTxFailed(txId, e instanceof Error ? e.message : "spend failed");
        await syncWallet();
        openTopUp(15);
        pushToast("Not enough coins — recharge required");
        return false;
      }
    },
    [openTopUp, pushToast, refreshEngagement, syncWallet, userId],
  );

  const spend = useCallback(
    (
      amount: number,
      label?: string,
      meta?: {
        type?: CoinTxType;
        hostId?: string;
        callId?: string;
        giftId?: string;
        clientTxId?: string;
      },
    ) => {
      if (coins < amount) {
        openTopUp(15);
        pushToast("Not enough coins — recharge required");
        return false;
      }
      const txId = meta?.clientTxId ?? spendTxId(label || "spend");
      if (hasCompletedTx(txId)) return true;
      const prevCoins = coins;
      const prevXp = xp;
      setCoins((c) => c - amount);
      setXp((x) => x + amount);
      recordPendingTx({
        id: txId,
        userId,
        amount,
        type: meta?.type ?? "spend",
        reason: label || "spend",
        hostId: meta?.hostId,
        callId: meta?.callId,
        giftId: meta?.giftId,
      });
      appendLocalHistory(amount, label || "spend", "spend");
      refreshEngagement();
      void spendCoinsApi({
        amount,
        reason: label || "spend",
        clientTxId: txId,
        meta: {
          hostId: meta?.hostId,
          callId: meta?.callId,
          giftId: meta?.giftId,
          type: meta?.type,
        },
      })
        .then((wallet) => {
          markTxCompleted(txId, { serverId: wallet.transactionId });
          setCoins(wallet.coinBalance);
          setXp(wallet.xp);
        })
        .catch((e) => {
          markTxRolledBack(txId, e instanceof Error ? e.message : "spend failed");
          setCoins(prevCoins);
          setXp(prevXp);
          void syncWallet();
          openTopUp(15);
          pushToast("Payment failed — balance restored");
        });
      if (label) pushToast(label);
      return true;
    },
    [coins, openTopUp, pushToast, refreshEngagement, syncWallet, userId, xp],
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
      const nowFollowing = toggleFollowLocal(id);
      const next = getFollowing();
      setFollowingList(next);
      setFollowing(next);
      if (nowFollowing) {
        setEngagement(recordFollow());
        pushRecentHost(id);
      }
      void (async () => {
        try {
          const { requireApiBase } = await import("@/config/apiConfig");
          const { getDeviceUserId } = await import("@/lib/walletApi");
          const { getAuthHeaders } = await import("@/lib/authSession");
          const me = getDeviceUserId();
          await fetch(
            `${requireApiBase()}/hosts/${encodeURIComponent(id)}/follow`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-User-Id": me,
                ...getAuthHeaders(),
              },
              body: JSON.stringify({ userId: me, follow: nowFollowing }),
            },
          );
        } catch {
          /* local follow still works offline */
        }
      })();
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
      } catch (e) {
        pushToast(
          e instanceof Error
            ? e.message
            : "VIP requires verified purchase",
        );
        throw e;
      }
      // VIP coin grants come only from verified IAP / admin — never client mint.
      void welcomeCoins;
      await applyReward(markVipJoined());
      triggerEntranceBlast();
      pushToast("Welcome to Luma VIP");
    },
    [applyReward, creditReward, pushToast, triggerEntranceBlast],
  );

  const value = useMemo(
    () => ({
      ready,
      clientReady,
      userId,
      displayName,
      avatarUrl,
      bio,
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
      applyLocalCoins,
      updateDisplayName,
      updateAvatar,
      updateBio,
      uploadGalleryAvatar,
      addXp,
      toggleFollow,
      setPremium,
      activatePremium,
      pushToast,
      topUpOpen,
      topUpGrace,
      topUpWarning,
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
      clientReady,
      userId,
      displayName,
      avatarUrl,
      bio,
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
      applyLocalCoins,
      updateDisplayName,
      updateAvatar,
      updateBio,
      uploadGalleryAvatar,
      addXp,
      toggleFollow,
      activatePremium,
      pushToast,
      topUpOpen,
      topUpGrace,
      topUpWarning,
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
