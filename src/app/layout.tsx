import type { Metadata, Viewport } from "next";
import { Syne, Manrope } from "next/font/google";
import { AppProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { ToastHost } from "@/components/ToastHost";
import { DiamondEntranceBlast } from "@/components/DiamondEntranceBlast";
import { WelcomePushEngine } from "@/components/welcome/WelcomePushEngine";
import { CoinBurstHost } from "@/components/engagement/CoinBurstHost";
import { ChatUnreadWatcher } from "@/components/ChatUnreadWatcher";
import { OfflineBanner } from "@/components/OfflineBanner";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Zuko — Premium voice & video calling",
  description:
    "Discover hosts, 1v1 calls, daily rewards, Lucky Spin, VIP, and coins — a premium live calling experience.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0d12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable} h-full`}>
      <body className="app-atmosphere app-grain min-h-full antialiased">
        <AppProvider>
          <div className="phone-shell safe-bottom relative max-w-[min(100vw,430px)] overflow-x-hidden">
            <DiamondEntranceBlast />
            <CoinBurstHost />
            <OfflineBanner />
            {children}
            <BottomNav />
            <ToastHost />
            <WelcomePushEngine />
            <ChatUnreadWatcher />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
