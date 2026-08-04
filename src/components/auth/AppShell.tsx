"use client";

import { usePathname } from "next/navigation";
import { AndroidBackBridge } from "@/components/AndroidBackBridge";
import { BottomNav } from "@/components/BottomNav";
import { ChatUnreadWatcher } from "@/components/ChatUnreadWatcher";
import { CoinBurstHost } from "@/components/engagement/CoinBurstHost";
import { DiamondEntranceBlast } from "@/components/DiamondEntranceBlast";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PushBootstrap } from "@/components/PushBootstrap";
import { ToastHost } from "@/components/ToastHost";
import { WelcomePushEngine } from "@/components/welcome/WelcomePushEngine";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/otp", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authPage = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return (
    <div className="phone-shell safe-bottom relative max-w-[min(100vw,430px)] overflow-x-hidden">
      {!authPage && <DiamondEntranceBlast />}
      {!authPage && <CoinBurstHost />}
      {!authPage && <OfflineBanner />}
      {children}
      {!authPage && <BottomNav />}
      <ToastHost />
      {!authPage && <WelcomePushEngine />}
      {!authPage && <ChatUnreadWatcher />}
      {!authPage && <PushBootstrap />}
      {!authPage && <AndroidBackBridge />}
    </div>
  );
}
