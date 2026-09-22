"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "glass";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  haptic?: "light" | "medium" | "heavy" | "none";
  children: React.ReactNode;
}

export default function AnimatedButton({
  variant = "primary",
  size = "md",
  loading = false,
  haptic = "light",
  disabled,
  className = "",
  onClick,
  children,
  ...props
}: AnimatedButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-bold tracking-tight rounded-2xl transition-colors select-none focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm gap-2",
    lg: "px-6 py-3.5 text-sm sm:text-base gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 active:shadow-xs",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80 shadow-2xs",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/20",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    glass:
      "bg-white/80 backdrop-blur-md text-slate-800 border border-white/40 shadow-sm hover:bg-white/95",
  }[variant];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (haptic !== "none") triggerHaptic(haptic);
    onClick?.(e);
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.96 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      transition={MOTION_SPRINGS.snappy}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
