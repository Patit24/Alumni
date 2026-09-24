"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, Phone, Users, ShieldCheck, Home } from "lucide-react";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

export type NavTab = "CHATS" | "CALLS" | "CONTACTS" | "PRIVACY";

interface FloatingBottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount?: number;
  missedCallsCount?: number;
}

export default function FloatingBottomNav({
  activeTab,
  onTabChange,
  unreadCount = 0,
  missedCallsCount = 0,
}: FloatingBottomNavProps) {
  const tabs = [
    {
      id: "CHATS" as NavTab,
      label: "Chats",
      icon: MessageSquare,
      badge: unreadCount,
    },
    {
      id: "CALLS" as NavTab,
      label: "Calls",
      icon: Phone,
      badge: missedCallsCount,
    },
    {
      id: "CONTACTS" as NavTab,
      label: "Contacts",
      icon: Users,
    },
    {
      id: "PRIVACY" as NavTab,
      label: "Privacy",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={MOTION_SPRINGS.gentle}
        className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-slate-900/10 rounded-full p-1.5 flex items-center gap-1 sm:gap-2 max-w-md w-full justify-around"
      >
        {/* 1-Click Back to Home */}
        <Link
          href="/"
          onClick={() => triggerHaptic("light")}
          className="relative flex items-center justify-center p-2 rounded-full text-slate-500 hover:text-[#ff9933] hover:bg-orange-50/80 transition select-none"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </Link>

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isActive) {
                  triggerHaptic("medium");
                  onTabChange(tab.id);
                }
              }}
              className="relative flex items-center justify-center py-2 px-3 sm:px-4 rounded-full text-xs font-bold transition-colors select-none focus:outline-hidden"
            >
              {/* Active Tab Spring Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  transition={MOTION_SPRINGS.snappy}
                  className="absolute inset-0 bg-[#000080] rounded-full shadow-md shadow-[#000080]/20"
                />
              )}

              {/* Icon & Label Content */}
              <div
                className={`relative z-10 flex items-center gap-1.5 transition-colors ${
                  isActive ? "text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={MOTION_SPRINGS.snappy}
                  className="relative"
                >
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  {/* Badge Notification */}
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span className="absolute -top-1.5 -right-2 h-4 w-4 rounded-full bg-[#138808] text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
                      {tab.badge}
                    </span>
                  )}
                </motion.div>

                <motion.span
                  animate={{ opacity: isActive ? 1 : 0.8 }}
                  className="text-[11px] sm:text-xs tracking-tight"
                >
                  {tab.label}
                </motion.span>
              </div>
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
