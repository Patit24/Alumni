"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { MOTION_SPRINGS, triggerHaptic } from "@/lib/motion/tokens";

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  isInteractive?: boolean;
  elevation?: "flat" | "low" | "medium" | "high";
  children: React.ReactNode;
}

export default function AnimatedCard({
  isInteractive = true,
  elevation = "low",
  className = "",
  onClick,
  children,
  ...props
}: AnimatedCardProps) {
  const elevationClasses = {
    flat: "bg-white border border-slate-200/70",
    low: "bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs",
    medium: "bg-white border border-slate-200 shadow-md shadow-slate-900/5",
    high: "bg-white border border-slate-200 shadow-xl shadow-slate-900/10",
  }[elevation];

  return (
    <motion.div
      whileTap={isInteractive ? { scale: 0.985 } : undefined}
      whileHover={isInteractive ? { y: -1.5 } : undefined}
      transition={MOTION_SPRINGS.snappy}
      onClick={(e) => {
        if (isInteractive && onClick) {
          triggerHaptic("light");
          onClick(e);
        }
      }}
      className={`rounded-3xl transition-colors ${elevationClasses} ${
        isInteractive ? "cursor-pointer select-none active:bg-slate-50/80" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
