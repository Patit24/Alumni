"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Heart } from "lucide-react";
import { triggerHaptic, MOTION_SPRINGS } from "@/lib/motion/tokens";

export default function AppOpeningPoster() {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if user previously opted out or has already seen it in this session
    const isPermanentlyHidden = localStorage.getItem("alumni_hide_opening_poster") === "true";
    const isSessionDismissed = sessionStorage.getItem("alumni_poster_seen") === "true";

    if (!isPermanentlyHidden && !isSessionDismissed) {
      // Small delay on first mount to let initial page layout settle smoothly
      const initTimer = setTimeout(() => {
        setIsOpen(true);
      }, 350);
      return () => clearTimeout(initTimer);
    }
  }, []);

  // Countdown timer for auto-dismiss
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCountdown(6);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // Allow manual opening via custom event from anywhere in the app
  useEffect(() => {
    const handleManualOpen = () => {
      setIsOpen(true);
      setCountdown(8);
    };
    window.addEventListener("open-made-in-india-poster", handleManualOpen);
    return () => window.removeEventListener("open-made-in-india-poster", handleManualOpen);
  }, []);

  const handleDismiss = () => {
    triggerHaptic("light");
    if (timerRef.current) clearInterval(timerRef.current);
    sessionStorage.setItem("alumni_poster_seen", "true");
    if (dontShowAgain) {
      localStorage.setItem("alumni_hide_opening_poster", "true");
    }
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={handleDismiss}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={MOTION_SPRINGS.bouncy}
            className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Tricolor Accent Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-emerald-600 shrink-0" />

            {/* Header controls */}
            <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/80 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🇮🇳</span>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  Proudly Made in India
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold border border-orange-200/60">
                  Campus App
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismiss}
                  className="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                  title="Close poster"
                >
                  <span>Skip</span>
                  <span className="text-[11px] text-slate-500 font-mono">({countdown}s)</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-95"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Poster Image Container */}
            <div className="relative w-full bg-slate-100 flex items-center justify-center overflow-hidden max-h-[66vh] sm:max-h-[70vh]">
              <Image
                src="/images/made-in-india-poster.jpg"
                alt="Proudly Made in India - Indian Hearts, Indian Technology, For a Better Tomorrow"
                width={682}
                height={1024}
                priority
                className="w-full h-auto max-h-[66vh] sm:max-h-[70vh] object-contain select-none"
              />
            </div>

            {/* Bottom Actions */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-100 flex flex-col gap-2.5 shrink-0">
              <button
                onClick={handleDismiss}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-600 to-emerald-600 hover:from-orange-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <span>Enter Alumni App</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Don&apos;t show on startup</span>
                </label>

                <span className="flex items-center gap-1 text-slate-400">
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  <span>Built for India</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
