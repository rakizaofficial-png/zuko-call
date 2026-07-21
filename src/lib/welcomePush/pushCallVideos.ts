/**
 * Provided push-call video assets (bundled in /public/push-calls).
 * These portrait clips are attached directly to the incoming push-call /
 * automated video-call UI so a real video renders reliably on mobile — no
 * dependency on remote (Pexels/CDN) URLs that can be blocked or slow on the
 * Android WebView.
 */

export const PUSH_CALL_VIDEOS = [
  "/push-calls/call-1.mp4",
  "/push-calls/call-2.mp4",
  "/push-calls/call-3.mp4",
  "/push-calls/call-4.mp4",
  "/push-calls/call-5.mp4",
  "/push-calls/call-6.mp4",
] as const;

function seedHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Stable per-host pick so a given caller always shows the same clip within a
 * session (avoids flicker), while different hosts vary.
 */
export function pickPushCallVideo(seed?: string): string {
  const s = (seed || "").trim();
  if (!s) return PUSH_CALL_VIDEOS[0];
  return PUSH_CALL_VIDEOS[seedHash(s) % PUSH_CALL_VIDEOS.length];
}
