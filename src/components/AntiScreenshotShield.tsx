"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert, Lock } from "lucide-react";
import { setNativeScreenshotAllowed } from "@/lib/native-security";
import { motion, AnimatePresence } from "framer-motion";

export default function AntiScreenshotShield() {
  const pathname = usePathname();
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [alertToast, setAlertToast] = useState<string | null>(null);
  const unshieldTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Activate protection ONLY on active chat / messaging routes (e.g. 1-on-1 SMS, group chat, channel chat)
  const isChatRoute = Boolean(
    pathname && (
      pathname.startsWith("/messages/") ||
      pathname.startsWith("/groups/") ||
      pathname.includes("/channels/")
    )
  );

  // 1. Manage Native OS hardware protection (Capacitor iOS/Android)
  useEffect(() => {
    if (!isChatRoute) {
      // Allow screenshots everywhere outside of chat SMS
      setNativeScreenshotAllowed(true);
      return;
    }

    // Inside chat SMS: restrict native screenshots
    setNativeScreenshotAllowed(false);

    return () => {
      // Re-enable when leaving chat
      setNativeScreenshotAllowed(true);
    };
  }, [isChatRoute]);

  // 2. Manage in-chat browser screen capture detection
  useEffect(() => {
    if (!isChatRoute) {
      setIsShieldActive(false);
      setAlertToast(null);
      return;
    }

    // Wipe clipboard with security notice on screenshot attempt
    const secureClipboard = () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText("Screenshots and screen captures are protected in this private chat.")
            .catch(() => {});
        }
      } catch {}
    };

    // Trigger obfuscation shield & broadcast snapshot event
    const triggerShield = (reason: string, durationMs = 3000) => {
      setIsShieldActive(true);
      secureClipboard();
      setAlertToast(reason);

      // Broadcast screenshot event for in-chat Snapchat-style notification pill
      window.dispatchEvent(
        new CustomEvent("samparka:screenshot-detected", {
          detail: { reason, timestamp: Date.now() },
        })
      );

      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
      unshieldTimerRef.current = setTimeout(() => {
        setIsShieldActive(false);
        setAlertToast(null);
      }, durationMs);
    };

    // Listen to keyboard shortcuts for screenshot, snip, print
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMetaShift =
        (e.metaKey && (e.shiftKey || e.key === "Shift")) ||
        (e.shiftKey && (e.metaKey || e.key === "Meta"));

      const isCtrlShift =
        (e.ctrlKey && (e.shiftKey || e.key === "Shift")) ||
        (e.shiftKey && (e.ctrlKey || e.key === "Control"));

      if (isMetaShift || isCtrlShift) {
        triggerShield("Screen capture shortcut detected in chat.", 3000);
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
        triggerShield("Screen capture shortcut detected in chat.", 3000);
        return false;
      }

      if (isPrint) {
        e.preventDefault();
        e.stopPropagation();
        triggerShield("Printing and exporting chat are restricted.", 2500);
        return false;
      }
    };

    // Obfuscate on Window Blur (e.g. Snipping tool stealing focus)
    const handleBlur = () => {
      setIsShieldActive(true);
    };

    const handleFocus = () => {
      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
      unshieldTimerRef.current = setTimeout(() => {
        setIsShieldActive(false);
      }, 350);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsShieldActive(true);
      } else {
        handleFocus();
      }
    };

    // Prevent context menu & drag on restricted media inside chat
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

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      if (unshieldTimerRef.current) clearTimeout(unshieldTimerRef.current);
    };
  }, [isChatRoute]);

  // If outside of chat SMS, completely disable shield UI
  if (!isChatRoute) {
    return null;
  }

  return (
    <>
      {/* In-Chat Instant Obfuscation Shield */}
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
                Chat Content Protected
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Screenshots and screen capture are restricted inside private chats to safeguard messages.
              </p>
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
                  Click or focus chat to resume
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating In-Chat Screenshot Warning Toast */}
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
