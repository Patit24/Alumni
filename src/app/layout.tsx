import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileBottomNav from "@/components/MobileBottomNav";
import CallModal from "@/components/CallModal";
import GlobalRealtimeProvider from "@/components/GlobalRealtimeProvider";
import AntiScreenshotShield from "@/components/AntiScreenshotShield";

export const metadata: Metadata = {
  title: "Samparka | Connect. Chat. Belong.",
  description: "A secure connection platform built for everyone. Private encrypted chat, verified communities, and voice & video communication. Proudly Made in India.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Samparka",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#080811",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#080811] text-white selection:bg-[#ff9933]/30 selection:text-orange-200">
        <GlobalRealtimeProvider />
        <AntiScreenshotShield />
        {children}
        <CallModal />
        <MobileBottomNav />
      </body>
    </html>
  );
}
