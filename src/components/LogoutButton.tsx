"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition inline-flex items-center gap-1.5 text-xs font-medium"
      title="Sign Out"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      ) : (
        <>
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </>
      )}
    </button>
  );
}
