"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Soft offline mode banner — keeps UI usable with cached lists */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(100%,430px)] -translate-x-1/2 px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 shadow-lg backdrop-blur-xl">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        Offline mode — showing cached hosts. Calls need a connection.
      </div>
    </div>
  );
}
