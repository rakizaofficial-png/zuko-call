"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  Shield,
  UserRound,
} from "lucide-react";
import {
  getSession,
  logoutAccount,
  type AuthSession,
} from "@/lib/authSession";
import { getUiLang, setUiLang, t, type LangCode } from "@/lib/i18n";
import { useApp } from "@/lib/store";

const NOTIFY_KEY = "zuko_notify_prefs_v1";

type NotifyPrefs = {
  recharge: boolean;
  vip: boolean;
  promo: boolean;
  calls: boolean;
  admin: boolean;
};

const DEFAULT_NOTIFY: NotifyPrefs = {
  recharge: true,
  vip: true,
  promo: true,
  calls: true,
  admin: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const { pushToast } = useApp();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [lang, setLang] = useState<LangCode>("en");
  const [dark, setDark] = useState(true);
  const [notify, setNotify] = useState<NotifyPrefs>(DEFAULT_NOTIFY);

  useEffect(() => {
    setSession(getSession());
    try {
      const code = getUiLang();
      setLang(code);
      setUiLang(code);
      const isLight = localStorage.getItem("luma_theme") === "light";
      setDark(!isLight);
      document.documentElement.classList.toggle("light", isLight);
      const raw = localStorage.getItem(NOTIFY_KEY);
      if (raw) setNotify({ ...DEFAULT_NOTIFY, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const saveLang = (v: LangCode) => {
    setLang(v);
    setUiLang(v);
    pushToast(t("language", v));
  };

  const toggleDark = () => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
    localStorage.setItem("luma_theme", nextDark ? "dark" : "light");
  };

  const toggleNotify = (key: keyof NotifyPrefs) => {
    setNotify((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    logoutAccount();
    setSession(null);
    pushToast("Signed out — session cleared");
    router.push("/login");
  };

  return (
    <main className="min-h-dvh overflow-x-hidden pb-28">
      <header className="safe-header sticky top-0 z-30 flex items-center gap-3 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <Link href="/profile" className="rounded-full bg-ink-3 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-coral">
            Zuko
          </p>
          <h1 className="font-display text-xl font-bold">{t("settings", lang)}</h1>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-ink-2/70 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/15 text-coral">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">
                {session?.user.name || "Guest"}
              </p>
              <p className="truncate text-[11px] text-muted">
                {session?.user.email || "Sign in to secure your session"}
              </p>
            </div>
            {!session ? (
              <Link
                href="/login"
                className="rounded-full bg-coral px-3 py-1.5 text-[11px] font-bold text-white"
              >
                Sign in
              </Link>
            ) : null}
          </div>
        </motion.div>

        <SettingsGroup title="Appearance">
          <Row
            icon={<Moon className="h-4 w-4" />}
            label={t("darkMode", lang)}
            trailing={
              <button
                type="button"
                onClick={toggleDark}
                className={`relative h-7 w-12 rounded-full transition ${
                  dark ? "bg-coral" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                    dark ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            }
          />
          <Row
            icon={<Languages className="h-4 w-4" />}
            label={t("language", lang)}
            trailing={
              <select
                value={lang}
                onChange={(e) => saveLang(e.target.value as LangCode)}
                className="rounded-xl border border-line bg-ink px-2 py-1.5 text-xs outline-none"
              >
                <option value="en">English</option>
                <option value="ur">Urdu</option>
                <option value="hi">Hindi</option>
                <option value="ar">Arabic</option>
              </select>
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          {(
            [
              ["recharge", "Recharge alerts"],
              ["vip", "VIP updates"],
              ["promo", "Promotions"],
              ["calls", "Call notifications"],
              ["admin", "Admin announcements"],
            ] as const
          ).map(([key, label]) => (
            <Row
              key={key}
              icon={<Bell className="h-4 w-4" />}
              label={label}
              trailing={
                <button
                  type="button"
                  onClick={() => toggleNotify(key)}
                  className={`relative h-7 w-12 rounded-full transition ${
                    notify[key] ? "bg-coral" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                      notify[key] ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              }
            />
          ))}
        </SettingsGroup>

        <SettingsGroup title="Security & privacy">
          <Link href="/forgot-password" className="block">
            <Row
              icon={<KeyRound className="h-4 w-4" />}
              label="Change password"
              trailing={<ChevronRight className="h-4 w-4 text-muted" />}
            />
          </Link>
          <Row
            icon={<Shield className="h-4 w-4" />}
            label="Secure session"
            trailing={
              <span className="text-[11px] font-semibold text-teal">
                {session ? "Active" : "Guest"}
              </span>
            }
          />
          <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted">
            JWT-shaped tokens are stored on-device. Wallet balances, coin prices,
            and payments are never editable by the user app.
          </p>
        </SettingsGroup>

        {session ? (
          <button
            type="button"
            onClick={logout}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-coral/40 bg-coral/10 text-sm font-bold text-coral"
          >
            <LogOut className="h-4 w-4" />
            {t("logout", lang)}
          </button>
        ) : null}

        <p className="pb-4 text-center text-[10px] text-muted">
          Zuko User · Android · Google Play ready
        </p>
      </section>
    </main>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink-2/60">
      <p className="px-3.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted">
        {title}
      </p>
      <div className="divide-y divide-line/80">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  trailing: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-3.5 py-2.5">
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      {trailing}
    </div>
  );
}
