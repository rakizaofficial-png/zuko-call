/**
 * ============================================================================
 * LUMA USER APP — PRODUCTION ENVIRONMENT CONFIG
 * ============================================================================
 *
 * STEP-BY-STEP EXTERNAL ACCOUNT SETUP
 * ------------------------------------
 * 1) AGORA (1v1 / Party / PK WebRTC)
 *    a. Go to https://console.agora.io → Create Project → Enable "App ID + Certificate"
 *    b. Copy App ID into NEXT_PUBLIC_AGORA_APP_ID (client)
 *    c. Copy App Certificate into the CoinCall API server only: AGORA_APP_CERTIFICATE
 *       NEVER put the certificate in this Next.js client bundle.
 *    d. Tokens are minted by POST/GET {API}/calls/:id/token — already wired.
 *
 * 2) COINCALL BACKEND API
 *    a. Deploy CoinCall/server (Render / Fly / Railway)
 *    b. Set NEXT_PUBLIC_API_BASE_URL=https://YOUR-API-HOST/api
 *
 * 3) FIREBASE (FCM push + optional Realtime DB)
 *    a. https://console.firebase.google.com → Add Web App
 *    b. Enable Cloud Messaging → generate Web Push certificates (VAPID)
 *    c. Paste keys into NEXT_PUBLIC_FIREBASE_* below
 *    d. For server push, put Firebase Admin JSON on the API host only
 *
 * 4) GOOGLE PLAY BILLING / APPLE IAP
 *    a. Google Play Console → Monetize → Products → create managed products
 *       matching pack SKUs in services/billing/iap.ts (e.g. luma_coins_50)
 *    b. Apple App Store Connect → In-App Purchases → same SKUs
 *    c. Validate receipts on the SERVER (POST /api/wallet/iap/verify) — never trust client
 *
 * 5) AI HOST CDN (optional prerecorded fallback)
 *    a. Upload intro.mp4 / loop.mp4 / teaser.mp4 per host to S3/R2/GCS
 *    b. Set NEXT_PUBLIC_AI_HOST_CDN=https://bucket…/ai-hosts
 *
 * Put secrets in `.env.local` (local) or your host’s env dashboard (production).
 * ============================================================================
 */

const read = (key: string, fallback = "") =>
  (typeof process !== "undefined"
    ? process.env[key] ?? fallback
    : fallback
  ).trim();

const PRODUCTION_API = "https://coincall-api.onrender.com/api";

export const env = {
  appEnv: read("NEXT_PUBLIC_APP_ENV", "production"),
  apiBaseUrl: read("NEXT_PUBLIC_API_BASE_URL", PRODUCTION_API).replace(
    /\/$/,
    "",
  ),

  agora: {
    /** Client App ID only — certificate stays on API */
    appId: read("NEXT_PUBLIC_AGORA_APP_ID"),
  },

  firebase: {
    apiKey: read("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: read("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: read("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: read("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: read("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: read("NEXT_PUBLIC_FIREBASE_APP_ID"),
    vapidKey: read("NEXT_PUBLIC_FIREBASE_VAPID_KEY"),
    databaseURL: read("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
  },

  aiHostCdn: read("NEXT_PUBLIC_AI_HOST_CDN"),
  welcomeTeaserUrl: read("NEXT_PUBLIC_WELCOME_TEASER_URL"),

  /** WebSocket URL — defaults to API host with /ws */
  wsUrl: read("NEXT_PUBLIC_WS_URL"),

  iap: {
    googlePlayPackageName: read(
      "NEXT_PUBLIC_ANDROID_PACKAGE",
      "com.luma.coincall",
    ),
    appleBundleId: read("NEXT_PUBLIC_IOS_BUNDLE_ID", "com.luma.coincall"),
  },
} as const;

export function resolveWsUrl() {
  if (env.wsUrl) return env.wsUrl;
  try {
    const u = new URL(env.apiBaseUrl);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "wss://coincall-api.onrender.com/ws";
  }
}

export function getMissingClientKeys(): string[] {
  const missing: string[] = [];
  if (!env.apiBaseUrl) missing.push("NEXT_PUBLIC_API_BASE_URL");
  if (!env.agora.appId) missing.push("NEXT_PUBLIC_AGORA_APP_ID");
  return missing;
}
