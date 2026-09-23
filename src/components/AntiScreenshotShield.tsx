"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { setNativeScreenshotAllowed } from "@/lib/native-security";
import { motion, AnimatePresence } from "framer-motion";

export default function AntiScreenshotShield() {
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [alertToast, setAlertToast] = useState<string | null>(null);
  const [userWatermark, setUserWatermark] = useState<string>("Samparka Secure");
  const unshieldTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load user identity for traceable visual watermark
  useEffect(() => {
    // 1. Try local storage first
    try {
      const stored = localStorage.getItem("alumni_user");
      if (stored) {
        const u = JSON.parse(stored);
        const identifier = u.username ? `@${u.username}` : u.name || u.phone || "Verified Alumni";
        setUserWatermark(identifier);
      }
    } catch {}

    // 2. Fetch authenticated user from API if available
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          const u = data.user;
          const identifier = u.username ? `@${u.username}` : u.name || u.phone || "Verified Alumni";
          setUserWatermark(identifier);
        }
      })
      .catch(() => {});

    // Enforce native OS hardware protection if running inside Capacitor Android/iOS
    setNativeScreenshotAllowed(false);

    return () => {
      setNativeScreenshotAllowed(true);
    };
  }, []);

  useEffect(() => {
    // 1. Wipe clipboard with security notice
    const secureClipboard = () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText("Screenshots and screen captures are protected and restricted on this platform.")
            .catch(() => {});
        }
      } catch {}
    };

    // 2. Trigger instant obfuscation shield
    const triggerShield = (reason: string, durationMs = 3500) => {
      setIsShieldActive(true);
      secureClipboard();
      setAlertToast(reason);

      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
      unshieldTimerRef.current = setTimeout(() => {
        setIsShieldActive(false);
        setAlertToast(null);
      }, durationMs);
    };

    // 3. Listen to keyboard shortcuts for screenshot, snip, print, devtools
    const handleKeyDown = (e: KeyboardEvent) => {
      // Pre-emptive detection: On macOS, Cmd+Shift is the prefix for Cmd+Shift+3/4/5.
      // On Windows, Ctrl+Shift is the prefix for snipping shortcuts.
      const isMetaShift =
        (e.metaKey && (e.shiftKey || e.key === "Shift")) ||
        (e.shiftKey && (e.metaKey || e.key === "Meta"));

      const isCtrlShift =
        (e.ctrlKey && (e.shiftKey || e.key === "Shift")) ||
        (e.shiftKey && (e.ctrlKey || e.key === "Control"));

      if (isMetaShift || isCtrlShift) {
        triggerShield("Screen capture shortcut detected. Content protected.", 3500);
        return;
      }

      const key = e.key;
      const isPrintScreen =
        key === "PrintScreen" ||
        e.code === "PrintScreen" ||
        key === "Snapshot" ||
        e.keyCode === 44;

      const isMacScreenshotKey =
        Boolean(e.metaKey) &&
        Boolean(e.shiftKey) &&
        ["3", "4", "5", "6", "$", "%", "^"].includes(key);

      const isWindowsSnip =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key.toLowerCase() === "s" || e.code === "KeyS");

      const isPrint =
        (e.ctrlKey || e.metaKey) &&
        (key.toLowerCase() === "p" || e.code === "KeyP");

      if (isPrintScreen || isMacScreenshotKey || isWindowsSnip) {
        e.preventDefault();
        e.stopPropagation();
        triggerShield("Screen capture shortcut detected. Content protected.", 3500);
        return false;
      }

      if (isPrint) {
        e.preventDefault();
        e.stopPropagation();
        triggerShield("Printing and PDF export are restricted.", 3000);
        return false;
      }
    };

    // 4. Obfuscate on Window Blur & Visibility Change
    // External snipping tools (Windows Snipping Tool, Mac crosshair selection, ShareX, Lightshot)
    // always steal window focus, triggering window.onblur or visibilitychange.
    const handleBlur = () => {
      setIsShieldActive(true);
    };

    const handleFocus = () => {
      // Delay unshield slightly so external tool has finished capturing
      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
      unshieldTimerRef.current = setTimeout(() => {
        setIsShieldActive(false);
      }, 400);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsShieldActive(true);
      } else {
        handleFocus();
      }
    };

    // 5. Detect mouse leaving to browser menubar / top bar
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        triggerShield("Screen focus lost.", 2000);
      }
    };

    // 6. Prevent context menu & drag on restricted media
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest(".screenshot-restricted") || target?.tagName === "IMG") {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest(".screenshot-restricted") || target?.tagName === "IMG") {
        e.preventDefault();
      }
    };

    // Attach listeners
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
    };
  }, []);

  const todayStr = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      {/* Indelible Forensic Anti-Leak Watermark (rendered at z-[998] so it sits ON TOP of all content, headers, and messages) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[998] overflow-hidden select-none flex flex-wrap gap-x-12 gap-y-16 p-4 justify-around content-around anti-screenshot-watermark"
      >
        {Array.from({ length: 36 }).map((_, i) => (
          <div
            key={i}
            className="text-[12px] font-mono font-black text-slate-800/[0.16] dark:text-white/[0.20] tracking-wider -rotate-24 select-none whitespace-nowrap"
          >
            {userWatermark} • {todayStr} • CONFIDENTIAL
          </div>
        ))}
      </div>

      {/* Instant Obfuscation Shield (triggers on window blur, snipping tool, or shortcut) */}
      <AnimatePresence>
        {isShieldActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="max-w-xs space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Protected View Active
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Screen capture and recording are restricted on this platform to safeguard alumni conversations and data.
              </p>
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
                  Click or focus tab to resume
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Screen Capture Warning Toast */}
      <AnimatePresence>
        {alertToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] bg-rose-950/90 text-rose-100 border border-rose-500/40 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{alertToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
