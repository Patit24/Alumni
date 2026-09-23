"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { triggerHaptic } from "@/lib/motion/tokens";

export default function MadeInIndiaSplashScreen() {
  const router = useRouter();
  const pathname = usePathname();

  const [showSplash, setShowSplash] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);

  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    // Check if the user has already opened the app in this session
    const hasLaunched = sessionStorage.getItem("alumni_app_launched");
    if (!hasLaunched) {
      setShowSplash(true);

      // 1. Check authentication status in parallel while splash is displaying
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          setIsAuthenticated(Boolean(data?.authenticated));
        })
        .catch(() => {
          setIsAuthenticated(false);
        });

      // 2. Animate progress bar over 2.4 seconds
      const startTime = Date.now();
      const duration = 2400;

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min(100, Math.round((elapsed / duration) * 100));
        setProgress(currentProgress);

        if (elapsed >= duration) {
          clearInterval(progressInterval);
        }
      }, 50);

      // 3. Auto-transition to next screen after 2.6 seconds
      const autoTimer = setTimeout(() => {
        handleProceed();
      }, 2600);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(autoTimer);
      };
    }
  }, []);

  // Allow manual preview via custom event from settings or footer
  useEffect(() => {
    const handleManualOpen = () => {
      hasNavigatedRef.current = false;
      setIsExiting(false);
      setProgress(0);
      setShowSplash(true);
      setTimeout(() => {
        handleProceed(true);
      }, 2600);
    };
    window.addEventListener("open-made-in-india-splash", handleManualOpen);
    return () => window.removeEventListener("open-made-in-india-splash", handleManualOpen);
  }, [isAuthenticated, pathname]);

  const handleProceed = (isPreview = false) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    triggerHaptic("medium");

    sessionStorage.setItem("alumni_app_launched", "true");
    setIsExiting(true);

    setTimeout(() => {
      setShowSplash(false);

      if (!isPreview) {
        // If user is not signed in and not already on /auth, guide to Get Started / Sign In page
        if (isAuthenticated === false && pathname !== "/auth") {
          router.push("/auth");
        }
      }
    }, 400);
  };

  if (!showSplash) return null;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="made-in-india-full-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[99999] flex flex-col justify-between items-center bg-[#FEF9F3] text-slate-900 select-none overflow-hidden touch-none"
        >
          {/* Edge-to-Edge Poster Image Display */}
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
            <Image
              src="/images/made-in-india-poster.jpg"
              alt="Made in India - Proudly Indian"
              fill
              priority
              quality={100}
              className="object-contain object-center select-none pointer-events-none"
              sizes="(max-width: 768px) 100vw, 500px"
            />
          </div>

          {/* Bottom Launch & Progress Bar (Safe Area Aware) */}
          <div className="w-full max-w-md px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 flex flex-col items-center gap-3 z-20 bg-gradient-to-t from-[#FEF9F3] via-[#FEF9F3]/95 to-transparent">
            {/* Tricolour Progress Bar */}
            <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden relative shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-600 rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* Status & CTA Row */}
            <div className="w-full flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                <span className="tracking-tight">
                  {progress < 100 ? "Initializing campus network..." : "Ready to connect"}
                </span>
              </div>

              {/* Get Started Button */}
              <button
                onClick={() => handleProceed()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition active:scale-95 shrink-0"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
