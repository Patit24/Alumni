"use client";

import { useEffect } from "react";

export default function ClientAuthRedirect() {
  useEffect(() => {
    try {
      // 1. Check if token was provided in URL query parameters (e.g. from OAuth redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");
      if (urlToken) {
        try {
          localStorage.setItem("alumni_session_token", urlToken);
        } catch {}
        // Clean URL to prevent token staying exposed in address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
        return;
      }

      // 2. Check localStorage backup token
      let localToken: string | null = null;
      try {
        localToken = localStorage.getItem("alumni_session_token");
      } catch {}

      const headers: Record<string, string> = {};
      if (localToken) {
        headers["Authorization"] = `Bearer ${localToken}`;
      }

      fetch("/api/auth/me", { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated) {
            if (data.token) {
              try {
                localStorage.setItem("alumni_session_token", data.token);
              } catch {}
            }
            window.location.reload();
          }
        })
        .catch(() => {});
    } catch {
      // Ignore
    }
  }, []);

  return null;
}
