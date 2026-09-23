import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileBottomNav from "@/components/MobileBottomNav";
import CallModal from "@/components/CallModal";
import GlobalRealtimeProvider from "@/components/GlobalRealtimeProvider";

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
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        <GlobalRealtimeProvider />
        {children}
        <CallModal />
        <MobileBottomNav />
      </body>
    </html>
  );
}
