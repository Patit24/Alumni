"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { MOTION_SPRINGS } from "@/lib/motion/tokens";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface AnimatedToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function AnimatedToast({ toasts, onDismiss }: AnimatedToastProps) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => {
          const icon = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
            info: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
          }[toast.type];

          const borderColors = {
            success: "border-emerald-200 bg-white/95 text-slate-900",
            error: "border-rose-200 bg-white/95 text-slate-900",
            info: "border-blue-200 bg-white/95 text-slate-900",
          }[toast.type];

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={MOTION_SPRINGS.bouncy}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border shadow-lg shadow-slate-900/10 backdrop-blur-md text-xs font-semibold ${borderColors}`}
            >
              {icon}
              <span className="leading-snug">{toast.message}</span>
              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
