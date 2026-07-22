"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Android hardware back — prefer in-app history over exiting the WebView.
 * Expo shell posts ZUKO_ANDROID_BACK; we also listen for browser popstate.
 */
export function AndroidBackBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const w = window as unknown as {
      ReactNativeWebView?: { postMessage: (s: string) => void };
      __ZUKO_ANDROID_BACK__?: () => boolean;
    };

    const isRoot =
      pathname === "/" ||
      pathname === "/live" ||
      pathname === "/call" ||
      pathname === "/messages" ||
      pathname === "/profile";

    w.__ZUKO_ANDROID_BACK__ = () => {
      if (isRoot) {
        // Let native shell exit / minimize
        try {
          w.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: "ZUKO_BACK_AT_ROOT" }),
          );
        } catch {
          /* ignore */
        }
        return false;
      }
      router.back();
      return true;
    };

    return () => {
      delete w.__ZUKO_ANDROID_BACK__;
    };
  }, [pathname, router]);

  return null;
}
