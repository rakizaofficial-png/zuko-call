/**
 * Minimal UI language dictionary for Settings language switch.
 */

export type LangCode = "en" | "ur" | "hi" | "ar";

const DICT: Record<LangCode, Record<string, string>> = {
  en: {
    settings: "Settings",
    darkMode: "Dark mode",
    language: "Language",
    logout: "Log out",
    signIn: "Sign in",
    profile: "Profile",
    wallet: "Wallet",
    help: "Help Center",
  },
  ur: {
    settings: "ترتیبات",
    darkMode: "ڈارک موڈ",
    language: "زبان",
    logout: "لاگ آؤٹ",
    signIn: "سائن ان",
    profile: "پروفائل",
    wallet: "والٹ",
    help: "مدد مرکز",
  },
  hi: {
    settings: "सेटिंग्स",
    darkMode: "डार्क मोड",
    language: "भाषा",
    logout: "लॉग आउट",
    signIn: "साइन इन",
    profile: "प्रोफ़ाइल",
    wallet: "वॉलेट",
    help: "सहायता केंद्र",
  },
  ar: {
    settings: "الإعدادات",
    darkMode: "الوضع الداكن",
    language: "اللغة",
    logout: "تسجيل الخروج",
    signIn: "تسجيل الدخول",
    profile: "الملف",
    wallet: "المحفظة",
    help: "مركز المساعدة",
  },
};

const LANG_KEY = "zuko_ui_lang_v1";

export function getUiLang(): LangCode {
  if (typeof window === "undefined") return "en";
  const v = localStorage.getItem(LANG_KEY) as LangCode | null;
  return v && DICT[v] ? v : "en";
}

export function setUiLang(code: LangCode) {
  localStorage.setItem(LANG_KEY, code);
  document.documentElement.lang = code;
  document.documentElement.dir = code === "ar" || code === "ur" ? "rtl" : "ltr";
}

export function t(key: string, lang?: LangCode): string {
  const code = lang || getUiLang();
  return DICT[code]?.[key] || DICT.en[key] || key;
}
