import type { Metadata, Viewport } from "next";
import { Syne, Manrope } from "next/font/google";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/auth/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GiftAnimationQueueProvider } from "@/components/gifts/GiftAnimationQueue";
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
          <GiftAnimationQueueProvider>
            <AuthGuard>
              <AppShell>{children}</AppShell>
            </AuthGuard>
          </GiftAnimationQueueProvider>
        </AppProvider>
      </body>
    </html>
  );
}
