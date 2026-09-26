"use client";

import { useEffect } from "react";

export default function NativeAppAuthListener() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        const isNative = typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
        if (!isNative) return;

        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");

        const processAuthUrl = async (rawUrl: string) => {
          if (!rawUrl) return;
          try {
            // Normalize custom scheme into standard URL format for parsing
            const normalizedUrl = rawUrl
              .replace("samparka://auth", "https://samparka.app/auth")
              .replace("samparka://", "https://samparka.app/")
              .replace("com.alumni.app://auth", "https://samparka.app/auth")
              .replace("com.alumni.app://", "https://samparka.app/");

            const urlObj = new URL(normalizedUrl);
            const token = urlObj.searchParams.get("token");
            const mode = urlObj.searchParams.get("mode");
            const signupToken = urlObj.searchParams.get("signupToken");

            try {
              await Browser.close();
            } catch {}

            if (token) {
              localStorage.setItem("alumni_session_token", token);
              // Clean address bar and redirect to home
              window.location.href = "/";
              return;
            }

            if (mode === "google-onboard" || signupToken) {
              const search = urlObj.search;
              window.location.href = `/auth${search}`;
              return;
            }
          } catch (e) {
            console.error("[NATIVE-AUTH] Failed to process incoming URL:", e);
          }
        };

        // 1. Check if the app was launched by a deep link
        try {
          const launchUrl = await App.getLaunchUrl();
          if (launchUrl?.url) {
            await processAuthUrl(launchUrl.url);
          }
        } catch {}

        // 2. Listen for deep link events while the app is running in foreground/background
        const listener = await App.addListener("appUrlOpen", async (data) => {
          if (data?.url) {
            await processAuthUrl(data.url);
          }
        });

        cleanup = () => {
          listener.remove();
        };
      } catch (err) {
        console.warn("[NATIVE-AUTH] Error initializing Capacitor listeners:", err);
      }
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}
