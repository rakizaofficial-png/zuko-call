"use client";

/**
 * FCM / push registration for the User App.
 * - Web: Firebase Messaging when VAPID + config present
 * - Android shell: native bridge posts tokens / opens deep links
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiConfig, requireApiBase } from "@/config/apiConfig";
import { getDeviceUserId } from "@/lib/walletApi";
import { getTotalUnread } from "@/lib/dmStore";

const TOKEN_KEY = "zuko_fcm_token_v1";

async function registerTokenWithServer(token: string, platform: string) {
  const userId = getDeviceUserId();
  if (!userId || !token) return;
  try {
    await fetch(`${requireApiBase()}/users/${encodeURIComponent(userId)}/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        token,
        platform,
        badge: getTotalUnread(),
      }),
      cache: "no-store",
    });
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* backend may not expose endpoint yet — keep local */
  }
}

async function initWebFcm() {
  const f = apiConfig.firebase;
  if (!f.apiKey || !f.projectId || !f.vapidKey || !f.messagingSenderId) {
    return;
  }
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, onMessage, isSupported } = await import(
      "firebase/messaging"
    );
    if (!(await isSupported())) return;

    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: f.apiKey,
        authDomain: f.authDomain,
        projectId: f.projectId,
        storageBucket: f.storageBucket,
        messagingSenderId: f.messagingSenderId,
        appId: f.appId,
      });

    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    const token = await getToken(messaging, {
      vapidKey: f.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (token) await registerTokenWithServer(token, "web");

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || "Zuko";
      const body = payload.notification?.body || "New message";
      const link =
        (payload.data?.link as string) ||
        (payload.data?.chatId
          ? `/messages/${payload.data.chatId}`
          : "/messages");
      try {
        const n = new Notification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: payload.data?.chatId || "zuko",
          data: { link },
        });
        n.onclick = () => {
          window.focus();
          window.location.href = link;
        };
      } catch {
        /* ignore */
      }
    });
  } catch (err) {
    console.warn("[fcm] web init failed", err);
  }
}

function initNativeBridge(onDeepLink: (path: string) => void) {
  const w = window as unknown as {
    ZukoNativePush?: {
      getToken?: () => Promise<string | null>;
      setBadge?: (n: number) => void;
    };
    __ZUKO_ON_PUSH_OPEN__?: (payload: { link?: string; chatId?: string }) => void;
  };

  w.__ZUKO_ON_PUSH_OPEN__ = (payload) => {
    const link =
      payload.link ||
      (payload.chatId ? `/messages/${payload.chatId}` : "/messages");
    onDeepLink(link);
  };

  void (async () => {
    try {
      const token = await w.ZukoNativePush?.getToken?.();
      if (token) await registerTokenWithServer(token, "android");
    } catch {
      /* bridge optional */
    }
  })();

  const syncBadge = () => {
    try {
      w.ZukoNativePush?.setBadge?.(getTotalUnread());
    } catch {
      /* ignore */
    }
  };
  syncBadge();
  const t = window.setInterval(syncBadge, 8000);
  return () => clearInterval(t);
}

/** Mount once at app root — registers FCM + handles notification deep links. */
export function PushBootstrap() {
  const router = useRouter();

  useEffect(() => {
    void initWebFcm();
    const cleanup = initNativeBridge((path) => {
      router.push(path);
    });
    return cleanup;
  }, [router]);

  return null;
}
