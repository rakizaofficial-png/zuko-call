"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; text: string };

type AppStore = {
  coins: number;
  isPremium: boolean;
  following: string[];
  toasts: Toast[];
  spend: (amount: number, label?: string) => boolean;
  addCoins: (amount: number, label?: string) => void;
  toggleFollow: (id: string) => void;
  setPremium: (v: boolean) => void;
  pushToast: (text: string) => void;
};

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState(320);
  const [isPremium, setPremium] = useState(false);
  const [following, setFollowing] = useState<string[]>(["c1", "c2"]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  const spend = useCallback(
    (amount: number, label?: string) => {
      if (coins < amount) {
        pushToast("Not enough coins — recharge on Play Store");
        return false;
      }
      setCoins((c) => c - amount);
      if (label) pushToast(label);
      return true;
    },
    [coins, pushToast],
  );

  const addCoins = useCallback(
    (amount: number, label?: string) => {
      setCoins((c) => c + amount);
      pushToast(label ?? `+${amount} coins added`);
    },
    [pushToast],
  );

  const toggleFollow = useCallback((id: string) => {
    setFollowing((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  }, []);

  const value = useMemo(
    () => ({
      coins,
      isPremium,
      following,
      toasts,
      spend,
      addCoins,
      toggleFollow,
      setPremium,
      pushToast,
    }),
    [coins, isPremium, following, toasts, spend, addCoins, toggleFollow, pushToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
