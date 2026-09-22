"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Compass, User, MessageSquare } from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Hide only on auth, inside direct chat, or messages section where sub-nav handles it
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/messages") ||
    pathname.match(/^\/groups\/[^/]+$/) ||
    pathname.match(/^\/communities\/[^/]+\/channels\/[^/]+$/)
  ) {
    return null;
  }

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/directory", label: "Network", icon: Users },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1 shadow-lg shadow-slate-900/5 sm:hidden pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 ${
                isActive
                  ? "text-blue-600 font-bold scale-105"
                  : "text-slate-400 hover:text-slate-600 font-medium"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  isActive ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
