"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { clearUserLocalVault } from "@/lib/e2ee/vault";
import { createClient } from "@/utils/supabase/client";

interface LogoutButtonProps {
  variant?: "header" | "prominent" | "mobile";
  className?: string;
  showTextOnMobile?: boolean;
}

export default function LogoutButton({
  variant = "header",
  className = "",
  showTextOnMobile = false,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      // 1. Clear IndexedDB client vault
      clearUserLocalVault();

      // 2. Sign out from Supabase client if OAuth session exists
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (sbErr) {
        console.warn("Supabase client signout notice:", sbErr);
      }

      // 3. Clear local & session storage
      if (typeof window !== "undefined") {
        try {
          sessionStorage.clear();
          localStorage.clear();
        } catch {}
      }

      // 4. Server-side session & cookie eradication
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});

      // 5. Force complete hard browser reload to /auth
      window.location.href = "/auth";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/auth";
    }
  };

  if (variant === "prominent") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className={`px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition flex items-center gap-2 active:scale-95 disabled:opacity-60 ${className}`}
        title="Sign Out"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
        ) : (
          <LogOut className="w-4 h-4 text-rose-600" />
        )}
        <span>{loading ? "Signing out..." : "Sign Out"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition inline-flex items-center gap-1.5 text-xs font-semibold active:scale-95 disabled:opacity-50 ${className}`}
      title="Sign Out"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      ) : (
        <>
          <LogOut className="w-4 h-4" />
          <span className={showTextOnMobile ? "inline" : "hidden sm:inline"}>
            Sign out
          </span>
        </>
      )}
    </button>
  );
}
