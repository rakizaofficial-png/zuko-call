import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/auth/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GiftAnimationQueueProvider } from "@/components/gifts/GiftAnimationQueue";
import "./globals.css";

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
    <html lang="en" className="h-full">
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
