"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Lock, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  Compass, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function JoinCommunityInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join community");

      setSuccess(true);
      setTimeout(() => {
        router.push(`/communities/${data.communityId}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Invalid or expired invite");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 backdrop-blur-2xl p-8 shadow-2xl text-center flex flex-col items-center">
        {/* Glow icon */}
        <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6">
          <Compass className="w-8 h-8" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          You've been invited to join a Community
        </h1>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-xs">
          Accept this invitation to join the private space with end-to-end encrypted channels, live calls, and shared calendars.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Invitation accepted! Redirecting to community...</span>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={loading}
            className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold text-xs hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Verifying Token & Encrypting Keys...</span>
            ) : (
              <>
                <span>Accept Invite & Join</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <Lock className="w-3 h-3 text-cyan-400" />
          <span>Zero-Knowledge & End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
}
