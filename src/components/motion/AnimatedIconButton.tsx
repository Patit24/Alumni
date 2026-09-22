"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

interface AnimatedIconButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "glass";
  size?: "sm" | "md" | "lg";
  isActive?: boolean;
  haptic?: "light" | "medium" | "heavy" | "none";
  children: React.ReactNode;
}

export default function AnimatedIconButton({
  variant = "ghost",
  size = "md",
  isActive = false,
  haptic = "light",
  disabled,
  className = "",
  onClick,
  children,
  ...props
}: AnimatedIconButtonProps) {
  const sizeClasses = {
    sm: "h-8 w-8 rounded-xl text-xs",
    md: "h-10 w-10 rounded-2xl text-sm",
    lg: "h-12 w-12 rounded-2xl text-base",
  }[size];

  const variantClasses = {
    primary: "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    glass: "bg-white/80 backdrop-blur-md text-slate-700 border border-white/40 shadow-2xs hover:bg-white",
  }[variant];

  const activeClasses = isActive
    ? "bg-blue-50 text-blue-600 border border-blue-200"
    : "";

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (haptic !== "none") triggerHaptic(haptic);
    onClick?.(e);
  };

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      transition={MOTION_SPRINGS.snappy}
      disabled={disabled}
      onClick={handleClick}
      className={`inline-flex items-center justify-center shrink-0 transition-colors focus:outline-hidden disabled:opacity-40 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${activeClasses} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
