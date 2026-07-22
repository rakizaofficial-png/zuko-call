/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker.
 * Keep firebase config in sync with NEXT_PUBLIC_FIREBASE_* (injected at runtime
 * via clients when possible; static fallbacks for production Render deploy).
 */
/* global importScripts, firebase, self */

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Messaging is initialized when the page posts config, or when env is baked in.
let messagingReady = false;

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "ZUKO_FCM_CONFIG" && data.config && !messagingReady) {
    try {
      firebase.initializeApp(data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || "Zuko";
        const body = payload.notification?.body || "New notification";
        const link =
          payload.data?.link ||
          (payload.data?.chatId
            ? `/messages/${payload.data.chatId}`
            : "/messages");
        self.registration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { link },
        });
      });
      messagingReady = true;
    } catch (e) {
      console.warn("[fcm-sw] init", e);
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/messages";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "ZUKO_PUSH_OPEN", link });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(link);
        }
      }),
  );
});
