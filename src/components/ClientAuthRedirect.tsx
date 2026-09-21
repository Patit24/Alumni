"use client";

import { useEffect } from "react";

export default function ClientAuthRedirect() {
  useEffect(() => {
    try {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated) {
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
