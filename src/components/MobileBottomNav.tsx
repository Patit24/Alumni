"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Users, Compass, User, MessageSquare } from "lucide-react";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [networkInvitesCount, setNetworkInvitesCount] = useState(0);

  useEffect(() => {
    const fetchInvites = () => {
      fetch("/api/contacts/requests")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.incoming)) {
            setNetworkInvitesCount(data.incoming.length);
          }
        })
        .catch(() => {});
    };

    fetchInvites();
    window.addEventListener("connection-requests-updated", fetchInvites);
    const interval = setInterval(fetchInvites, 12000);
    return () => {
      window.removeEventListener("connection-requests-updated", fetchInvites);
      clearInterval(interval);
    };
  }, []);

  // Hide only on auth, inside direct chat, or communities channel where chat input takes bottom
  if (
    pathname.startsWith("/auth") ||
    pathname.match(/^\/messages\/[^/]+$/) ||
    pathname.match(/^\/groups\/[^/]+$/) ||
    pathname.match(/^\/communities\/[^/]+\/channels\/[^/]+$/)
  ) {
    return null;
  }

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/directory", label: "Network", icon: Users, badge: networkInvitesCount },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-4 pointer-events-none pb-safe">
      <motion.nav
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={MOTION_SPRINGS.gentle}
        className="pointer-events-auto bg-[#0a0f1d]/92 backdrop-blur-2xl border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.7)] rounded-full p-1.5 flex items-center justify-around w-full max-w-sm sm:max-w-md relative overflow-hidden"
      >
        {/* Top subtle tricolor accent glow line */}
        <div aria-hidden className="absolute top-0 inset-x-8 h-[1.5px] bg-gradient-to-r from-transparent via-[#FF9933]/60 to-transparent" />

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
              prefetch={true}
              onClick={() => {
                if (!isActive) triggerHaptic("medium");
              }}
              className="relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-full select-none focus:outline-none transition-all active:scale-95 cursor-pointer"
            >
              {/* Active Spring Gliding Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="mobileNavActivePill"
                  transition={MOTION_SPRINGS.snappy}
                  className="absolute inset-0 bg-gradient-to-b from-white/12 to-white/4 rounded-full border border-[#FF9933]/40 shadow-[0_0_16px_rgba(255,153,51,0.22)]"
                />
              )}

              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={MOTION_SPRINGS.snappy}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive
                        ? "text-[#FF9933] drop-shadow-[0_0_8px_rgba(255,153,51,0.6)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#138808] text-white text-[9px] font-extrabold flex items-center justify-center border border-[#0a0f1d] shadow-[0_0_8px_rgba(19,136,8,0.7)] animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors duration-200 font-semibold ${
                    isActive ? "text-[#FF9933] font-bold" : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}

