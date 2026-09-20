import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileBottomNav from "@/components/MobileBottomNav";

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
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900 pb-16 sm:pb-0">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
