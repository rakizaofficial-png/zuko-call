/**
 * =============================================================================
 * LUMA USER APP — PRODUCTION API / SDK CONFIGURATION
 * =============================================================================
 *
 * STEP-BY-STEP EXTERNAL SETUP (do this before going live):
 *
 * 1) AGORA (1v1 / Party / PK video)
 *    - Create account: https://console.agora.io/
 *    - Create a project → copy App ID
 *    - Enable "Primary Certificate" → copy App Certificate (SERVER ONLY — never put in Next.js)
 *    - Put App ID in: NEXT_PUBLIC_AGORA_APP_ID
 *    - Put Certificate on CoinCall API only: AGORA_APP_CERTIFICATE
 *    - Tokens must be minted by your backend (`/api/calls/:id/token`) — never client-side.
 *
 * 2) COINCALL API (this is your source of truth for hosts, wallet, calls)
 *    - Deploy CoinCall/server (Render / Fly / Railway)
 *    - Set NEXT_PUBLIC_API_BASE_URL=https://YOUR-API.onrender.com/api
 *
 * 3) FIREBASE (optional FCM push for incoming-call alerts)
 *    - Firebase console → Project settings → Your apps → Web app
 *    - Copy config into NEXT_PUBLIC_FIREBASE_* below
 *    - Cloud Messaging → Web Push certificates → VAPID key
 *
 * 4) GOOGLE PLAY BILLING / APPLE IAP
 *    - Play Console → Monetize → Products → create managed products matching
 *      productIds in src/lib/payments/iapCatalog.ts
 *    - App Store Connect → In-App Purchases → same productIds
 *    - Server verifies purchase tokens via /api/wallet/iap/verify
 *
 * 5) AI HOST CDN (fallback prerecorded clips)
 *    - Upload intro.mp4 / loop.mp4 / teaser.mp4 to S3/GCS/R2
 *    - Set NEXT_PUBLIC_AI_HOST_CDN=https://bucket.../ai-hosts
 *
 * Copy this file's keys into `.env.local` (never commit secrets).
 * =============================================================================
 */

const read = (key: string, fallback = "") =>
  (typeof process !== "undefined" ? process.env[key] : undefined)?.trim() ||
  fallback;

/**
 * Native / mobile WebView fix:
 * The API + WebSocket URLs are baked at build time and may point at
 * `localhost` (the developer's machine). On a phone or Android emulator,
 * `localhost` resolves to the *device itself*, so those requests never reach
 * the backend — which is exactly why calls work in a desktop browser but fail
 * on the mobile app / emulator.
 *
 * When the page is served from a non-localhost host (e.g. the Android emulator
 * loads it via `http://10.0.2.2:3000`, or a device via a LAN IP), rewrite any
 * `localhost`/`127.0.0.1` API/WS host to the host that actually served the
 * page. On desktop (page host === localhost) this is a no-op, so web behaviour
 * is unchanged.
 */
function resolveReachableHost(url: string): string {
  if (typeof window === "undefined") return url;
  const pageHost = window.location?.hostname;
  if (!pageHost || pageHost === "localhost" || pageHost === "127.0.0.1") {
    return url;
  }
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    /* relative / non-absolute URL — leave untouched */
  }
  return url;
}

// Firebase Web configuration is public client metadata. Environment values can
// override it, while these production defaults keep Google sign-in working on
// the Render deployment and Android WebView shell.
const productionFirebase = {
  apiKey: "AIzaSyBzFRXeuDvjq6RG5VR4oky0Ra93AvVFZ50",
  authDomain: "lovecall-2291e.firebaseapp.com",
  projectId: "lovecall-2291e",
  storageBucket: "lovecall-2291e.firebasestorage.app",
  messagingSenderId: "469302066716",
  appId: "1:469302066716:web:79d8e7bce979bcf17529d9",
  databaseURL: "https://lovecall-2291e-default-rtdb.firebaseio.com",
} as const;

export const apiConfig = {
  env: read("NEXT_PUBLIC_APP_ENV", "production"),

  /** CoinCall Express API root including `/api` */
  apiBaseUrl: resolveReachableHost(
    read(
      "NEXT_PUBLIC_API_BASE_URL",
      "https://coincall-api.onrender.com/api",
    ).replace(/\/$/, ""),
  ),

  /** WebSocket URL — derived from API host unless overridden */
  wsUrl: (() => {
    const explicit = read("NEXT_PUBLIC_WS_URL");
    if (explicit) return resolveReachableHost(explicit.replace(/\/$/, ""));
    const api = read(
      "NEXT_PUBLIC_API_BASE_URL",
      "https://coincall-api.onrender.com/api",
    ).replace(/\/$/, "");
    try {
      const u = new URL(api.replace(/\/api$/, ""));
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = "/ws";
      return resolveReachableHost(u.toString().replace(/\/$/, ""));
    } catch {
      return "wss://coincall-api.onrender.com/ws";
    }
  })(),

  agora: {
    /** Public App ID only — certificate stays on server */
    appId: read("NEXT_PUBLIC_AGORA_APP_ID"),
  },

  firebase: {
    apiKey: read("NEXT_PUBLIC_FIREBASE_API_KEY", productionFirebase.apiKey),
    authDomain: read(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      productionFirebase.authDomain,
    ),
    projectId: read(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      productionFirebase.projectId,
    ),
    storageBucket: read(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      productionFirebase.storageBucket,
    ),
    messagingSenderId: read(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      productionFirebase.messagingSenderId,
    ),
    appId: read("NEXT_PUBLIC_FIREBASE_APP_ID", productionFirebase.appId),
    vapidKey: read("NEXT_PUBLIC_FIREBASE_VAPID_KEY"),
    databaseURL: read(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      productionFirebase.databaseURL,
    ),
  },

  aiHostCdn: read("NEXT_PUBLIC_AI_HOST_CDN"),
  welcomeTeaserUrl: read("NEXT_PUBLIC_WELCOME_TEASER_URL"),

  /**
   * Anonymous device user id — replace with real auth (Firebase Auth / JWT)
   * once you wire login. Stored in localStorage under this key.
   */
  deviceUserKey: "luma_device_user_id",
} as const;

export function getMissingClientKeys(): string[] {
  const missing: string[] = [];
  if (!apiConfig.apiBaseUrl) missing.push("NEXT_PUBLIC_API_BASE_URL");
  if (!apiConfig.agora.appId) missing.push("NEXT_PUBLIC_AGORA_APP_ID");
  return missing;
}

export function requireApiBase(): string {
  const base = apiConfig.apiBaseUrl;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. See src/config/apiConfig.ts setup guide.",
    );
  }
  return base;
}
