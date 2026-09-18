"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  Sparkles,
  Award,
  RefreshCw,
} from "lucide-react";

interface Batchmate {
  id: string;
  name: string;
  phone: string;
  currentRole: string | null;
  currentCompany: string | null;
  city: string | null;
  verificationStatus: string;
  department: { name: string } | null;
  vouchesReceived: { id: string }[];
}

interface VerificationData {
  currentUser: {
    id: string;
    name: string;
    verificationStatus: string;
    batchYear: number;
    institutionName: string;
  };
  virality: {
    joinedCount: number;
    verifiedCount: number;
    estimatedSize: number;
  };
  batchmates: Batchmate[];
  vouchesReceived: { confirmer: { name: string } }[];
  vouchesGivenIds: string[];
}

export default function VerificationPage() {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vouchingId, setVouchingId] = useState<string | null>(null);
  const [selfVerifying, setSelfVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchVerificationState = useCallback(async () => {
    try {
      const res = await fetch("/api/verification");
      if (!res.ok) throw new Error("Failed to load verification");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/verification");
        if (!res.ok) throw new Error("Failed to load verification");
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleVouch(targetUserId: string) {
    try {
      setVouchingId(targetUserId);
      setStatusMessage(null);
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to vouch");
      setStatusMessage(result.message);
      await fetchVerificationState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error vouching");
    } finally {
      setVouchingId(null);
    }
  }

  async function handleDemoSelfVerify() {
    try {
      setSelfVerifying(true);
      setStatusMessage(null);
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SELF_VERIFY_DEMO" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to self-verify");
      setStatusMessage(result.message);
      await fetchVerificationState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Self verification failed");
    } finally {
      setSelfVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading batch verification...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isCurrentUserVerified = data.currentUser.verificationStatus === "VERIFIED";
  const verifiedBatchmates = data.batchmates.filter((b) => b.verificationStatus === "VERIFIED");
  const unverifiedBatchmates = data.batchmates.filter((b) => b.verificationStatus === "UNVERIFIED");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Passive Verification</h1>
              <p className="text-[11px] text-slate-500">
                {data.currentUser.institutionName} • Class of {data.currentUser.batchYear}
              </p>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
              isCurrentUserVerified
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {isCurrentUserVerified ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Unverified
              </>
            )}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Alert Banner */}
        {statusMessage && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Batch Virality Counter Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-blue-200 bg-white/10 px-3 py-1 rounded-full">
                Batch Progress
              </span>
              <h2 className="text-xl sm:text-2xl font-bold mt-2">
                {data.virality.joinedCount} people from your batch are here
              </h2>
              <p className="text-xs text-blue-100 mt-1 max-w-lg">
                ~{data.virality.estimatedSize} estimated size for Class of {data.currentUser.batchYear}. As more batchmates join and vouch for one another, the network becomes trusted and spam-free.
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur rounded-2xl p-4 border border-white/20 text-center shrink-0 w-full sm:w-auto">
              <div className="text-2xl font-black">{data.virality.verifiedCount} / {data.virality.joinedCount}</div>
              <div className="text-[10px] font-semibold text-blue-100 uppercase tracking-wider">
                Batchmates Verified
              </div>
            </div>
          </div>
        </div>

        {/* Current User Verification Action */}
        {!isCurrentUserVerified ? (
          <div className="bg-amber-50 rounded-3xl border border-amber-200 p-5 sm:p-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900">
                  How Passive Verification Works
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  You don&apos;t need institutional IDs or manual admin reviews. Any verified batchmate from your <strong>Class of {data.currentUser.batchYear}</strong> can vouch for you with one tap.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={handleDemoSelfVerify}
                    disabled={selfVerifying}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {selfVerifying ? "Verifying..." : "Vouch from Verified Batchmate (Instant Demo)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-5 sm:p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">You are a Verified Member!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                {data.vouchesReceived.length > 0
                  ? `Vouched by ${data.vouchesReceived.map((v) => v.confirmer.name).join(", ")}.`
                  : "Your identity has been confirmed by your batchmates."} You can now post jobs and give mentorship!
              </p>
            </div>
          </div>
        )}

        {/* Section: Unverified Batchmates (Needs Your Vouch) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              Batchmates Awaiting Verification ({unverifiedBatchmates.length})
            </h3>
            <span className="text-[11px] text-slate-500">Class of {data.currentUser.batchYear}</span>
          </div>

          {unverifiedBatchmates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
              All currently registered batchmates from your class are verified!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {unverifiedBatchmates.map((batchmate) => {
                const alreadyVouched = data.vouchesGivenIds.includes(batchmate.id);
                return (
                  <div
                    key={batchmate.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-300 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900">{batchmate.name}</h4>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Unverified
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {batchmate.currentRole || "Alumni"}
                        {batchmate.currentCompany ? ` at ${batchmate.currentCompany}` : ""}
                      </p>
                      {batchmate.department && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Dept: {batchmate.department.name}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {batchmate.vouchesReceived.length} vouches
                      </span>
                      <button
                        onClick={() => handleVouch(batchmate.id)}
                        disabled={!isCurrentUserVerified || alreadyVouched || vouchingId === batchmate.id}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                          alreadyVouched
                            ? "bg-emerald-50 text-emerald-700 cursor-default"
                            : isCurrentUserVerified
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {alreadyVouched
                          ? "Vouched ✓"
                          : vouchingId === batchmate.id
                          ? "Vouching..."
                          : isCurrentUserVerified
                          ? "Vouch for Batchmate"
                          : "Verify Yourself First"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section: Verified Batchmates */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Verified Batchmates in Your Class ({verifiedBatchmates.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {verifiedBatchmates.map((batchmate) => (
              <div
                key={batchmate.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{batchmate.name}</h4>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {batchmate.currentRole || "Alumni"}
                    {batchmate.currentCompany ? ` at ${batchmate.currentCompany}` : ""}
                  </p>
                </div>
                <Link
                  href={`/profile/${batchmate.id}`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
