import type { Metadata } from "next";
import { Syne, Manrope } from "next/font/google";
import { AppProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { ToastHost } from "@/components/ToastHost";
import { DiamondEntranceBlast } from "@/components/DiamondEntranceBlast";
import { WelcomePushEngine } from "@/components/welcome/WelcomePushEngine";
import { CoinBurstHost } from "@/components/engagement/CoinBurstHost";
import { ChatUnreadWatcher } from "@/components/ChatUnreadWatcher";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable} h-full`}>
      <body className="app-atmosphere app-grain min-h-full antialiased">
        <AppProvider>
          <div className="phone-shell safe-bottom relative overflow-hidden">
            <DiamondEntranceBlast />
            <CoinBurstHost />
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
