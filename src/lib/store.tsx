"use client";

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
  connectRealtime,
  subscribeRealtime,
} from "@/services/realtime";
import {
  fetchWallet,
  getSessionToken,
  setSessionToken,
  spendCoinsApi,
  type UserWallet,
} from "@/services/walletApi";

type Toast = { id: number; text: string };

type AppStore = {
  ready: boolean;
  userId: string;
  displayName: string;
  coins: number;
  xp: number;
  vipTier: VipTier;
  isPremium: boolean;
  following: string[];
  toasts: Toast[];
  spend: (amount: number, label?: string) => boolean;
  spendAsync: (amount: number, label?: string) => Promise<boolean>;
  hydrateWallet: (wallet: UserWallet) => void;
  addCoins: (amount: number, label?: string) => void;
  addXp: (amount: number) => void;
  toggleFollow: (id: string) => void;
  setPremium: (v: boolean) => void;
  pushToast: (text: string) => void;
  topUpOpen: boolean;
  topUpGrace: number;
  openTopUp: (grace?: number) => void;
  closeTopUp: () => void;
  entranceBlast: boolean;
  entranceReady: boolean;
  triggerEntranceBlast: () => void;
  clearEntranceBlast: () => void;
  refreshWallet: () => Promise<void>;
};

const Ctx = createContext<AppStore | null>(null);

function ensureGuestToken(): string {
  const existing = getSessionToken();
  if (existing) return existing;
  const guest = `guest_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  setSessionToken(guest);
  return guest;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Luma Fan");
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [isPremium, setPremium] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpGrace, setTopUpGrace] = useState(15);
  const [entranceBlast, setEntranceBlast] = useState(false);
  const [entranceReady, setEntranceReady] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const vipTier = useMemo(() => vipTierFromXp(xp), [xp]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  const hydrateWallet = useCallback((wallet: UserWallet) => {
    setUserId(wallet.userId);
    setDisplayName(wallet.displayName);
    setCoins(wallet.coins);
    setXp(wallet.xp);
    setPremium(wallet.isPremium);
    setFollowing(wallet.following ?? []);
  }, []);

  const refreshWallet = useCallback(async () => {
    const token = ensureGuestToken();
    try {
      const wallet = await fetchWallet(token);
      hydrateWallet(wallet);
    } catch {
      // API cold start — keep last known; surface once ready fails softly
      pushToast("Wallet sync pending — reconnecting…");
    } finally {
      setReady(true);
      setEntranceReady(true);
    }
  }, [hydrateWallet, pushToast]);

  useEffect(() => {
    const token = ensureGuestToken();
    void refreshWallet();
    connectRealtime(token);
    const unsub = subscribeRealtime((ev) => {
      if (ev.type === "wallet_updated") {
        setCoins(ev.coins);
        setXp(ev.xp);
      }
    });
    return () => {
      unsub();
    };
  }, [refreshWallet]);

  const clearEntranceBlast = useCallback(() => {
    setEntranceBlast(false);
  }, []);

  const triggerEntranceBlast = useCallback(() => {
    setEntranceBlast(true);
  }, []);

  const closeTopUp = useCallback(() => {
    setTopUpOpen(false);
    if (graceTimer.current) {
      clearInterval(graceTimer.current);
      graceTimer.current = null;
    }
  }, []);

  const openTopUp = useCallback((grace = 15) => {
    setTopUpGrace(grace);
    setTopUpOpen(true);
    if (graceTimer.current) clearInterval(graceTimer.current);
    graceTimer.current = setInterval(() => {
      setTopUpGrace((g) => {
        if (g <= 1) {
          if (graceTimer.current) clearInterval(graceTimer.current);
          graceTimer.current = null;
          return 0;
        }
        return g - 1;
      });
    }, 1000);
  }, []);

  const addXp = useCallback((amount: number) => {
    setXp((x) => x + amount);
  }, []);

  /** Optimistic local gate + authoritative server spend */
  const spendAsync = useCallback(
    async (amount: number, label?: string) => {
      if (coins < amount) {
        openTopUp(15);
        pushToast("Low coins — recharge required");
        return false;
      }
      try {
        const wallet = await spendCoinsApi(
          amount,
          label || "spend",
          getSessionToken(),
        );
        hydrateWallet(wallet);
        if (label) pushToast(label);
        return true;
      } catch (e: unknown) {
        openTopUp(15);
        pushToast(e instanceof Error ? e.message : "Spend failed");
        void refreshWallet();
        return false;
      }
    },
    [coins, hydrateWallet, openTopUp, pushToast, refreshWallet],
  );

  const spend = useCallback(
    (amount: number, label?: string) => {
      if (coins < amount) {
        openTopUp(15);
        pushToast("Low coins — recharge required");
        return false;
      }
      // Fire-and-forget server sync; UI stays snappy
      void spendAsync(amount, label);
      setCoins((c) => c - amount);
      setXp((x) => x + amount);
      return true;
    },
    [coins, openTopUp, pushToast, spendAsync],
  );

  const addCoins = useCallback(
    (amount: number, label?: string) => {
      setCoins((c) => c + amount);
      if (label) pushToast(label);
      closeTopUp();
      void refreshWallet();
    },
    [closeTopUp, pushToast, refreshWallet],
  );

  const toggleFollow = useCallback((id: string) => {
    setFollowing((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  }, []);

  const value = useMemo(
    () => ({
      ready,
      userId,
      displayName,
      coins,
      xp,
      vipTier,
      isPremium,
      following,
      toasts,
      spend,
      spendAsync,
      hydrateWallet,
      addCoins,
      addXp,
      toggleFollow,
      setPremium,
      pushToast,
      topUpOpen,
      topUpGrace,
      openTopUp,
      closeTopUp,
      entranceBlast,
      entranceReady,
      triggerEntranceBlast,
      clearEntranceBlast,
      refreshWallet,
    }),
    [
      ready,
      userId,
      displayName,
      coins,
      xp,
      vipTier,
      isPremium,
      following,
      toasts,
      spend,
      spendAsync,
      hydrateWallet,
      addCoins,
      addXp,
      toggleFollow,
      pushToast,
      topUpOpen,
      topUpGrace,
      openTopUp,
      closeTopUp,
      entranceBlast,
      entranceReady,
      triggerEntranceBlast,
      clearEntranceBlast,
      refreshWallet,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
