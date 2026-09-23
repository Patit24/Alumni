import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileBottomNav from "@/components/MobileBottomNav";
import CallModal from "@/components/CallModal";
import GlobalRealtimeProvider from "@/components/GlobalRealtimeProvider";
import MadeInIndiaSplashScreen from "@/components/MadeInIndiaSplashScreen";

export const metadata: Metadata = {
  title: "Alumni Network | Connect, Mentor & Grow",
  description: "Connect with your alumni, find mentors, discover job referrals, and stay in touch with your alma mater.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Alumni Network",
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
        <MadeInIndiaSplashScreen />
        {children}
        <CallModal />
        <MobileBottomNav />
      </body>
    </html>
  );
}
