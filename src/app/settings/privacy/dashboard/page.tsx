"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  KeyRound,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Sparkles,
  Server,
  UserX,
  Radio,
  FileText,
  Sliders,
  Check,
  Loader2,
} from "lucide-react";
import { cleanMyPrivacy } from "@/lib/e2ee/vault";

export default function PrivacyDashboardPage() {
  const [privacyLockActive, setPrivacyLockActive] = useState(false);
  const [ghostNotifications, setGhostNotifications] = useState(true);
  const [contactDiscovery, setContactDiscovery] = useState(true);
  const [loading, setLoading] = useState(true);
  const [togglingLock, setTogglingLock] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [lockRes, setRes] = await Promise.all([
          fetch("/api/privacy/lock"),
          fetch("/api/privacy/settings"),
        ]);

        if (lockRes.ok) {
          const lData = await lockRes.json();
          setPrivacyLockActive(lData.privacyLockActive || false);
        }

        if (setRes.ok) {
          const sData = await setRes.json();
          if (sData.settings) {
            setGhostNotifications(sData.settings.ghostNotifications ?? true);
            setContactDiscovery(sData.settings.contactDiscoveryEnabled ?? true);
          }
        }
      } catch (err) {
        console.error("Failed to load privacy dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleTogglePrivacyLock = async () => {
    setTogglingLock(true);
    try {
      const res = await fetch("/api/privacy/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !privacyLockActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setPrivacyLockActive(data.privacyLockActive);
      }
    } catch (err) {
      console.error("Failed to toggle privacy lock:", err);
    } finally {
      setTogglingLock(false);
    }
  };

  const handleExecuteCleanup = async () => {
    setCleaning(true);
    try {
      await cleanMyPrivacy();
      setCleanSuccess(true);
      setTimeout(() => {
        setCleanSuccess(false);
        setShowCleanModal(false);
      }, 1500);
    } catch (err) {
      console.error("Clean privacy failed:", err);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings/privacy"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 leading-tight">My Privacy</h1>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-400">Audited cryptographic status & data transparency</p>
            </div>
          </div>

          <Link
            href="/settings/privacy"
            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Privacy Lock Banner */}
        {privacyLockActive ? (
          <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Privacy Lock Active</p>
                <p className="text-xs text-rose-800">Incoming calls blocked • Presence paused • Ghost mode enforced</p>
              </div>
            </div>
            <button
              onClick={handleTogglePrivacyLock}
              disabled={togglingLock}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 shrink-0"
            >
              {togglingLock ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0 backdrop-blur">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100">Private by Design</p>
                <p className="text-[11px] text-slate-300">End-to-end encrypted • Minimal server-side data</p>
              </div>
            </div>
            <button
              onClick={handleTogglePrivacyLock}
              disabled={togglingLock}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition border border-white/20 shrink-0 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Lock App</span>
            </button>
          </div>
        )}

        {/* Section 1: Privacy Protection Status Meters */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your Cryptographic Protections
            </h2>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              High Assurance
            </span>
          </div>

          <div className="space-y-3.5">
            {/* 1. Message Content */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" /> Message Content
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px]">Protected (AES-256-GCM)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-full" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Encrypted with per-conversation keys derived via HKDF (SHA-256).
              </p>
            </div>

            {/* 2. Call Streams */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-purple-600" /> Voice & Video Calls
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px]">Protected (DTLS-SRTP P2P)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-full" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Media streams directly peer-to-peer. Never recorded or stored by our servers.
              </p>
            </div>

            {/* 3. Private Keys */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Private Encryption Keys
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px]">Device Only</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-full" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Non-exportable NIST P-256 keys stored securely in local browser IndexedDB.
              </p>
            </div>

            {/* 4. Server Chat History */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-600" /> Permanent Server History
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px]">None (Zero Plaintext)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-full" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                The server only retains temporary encrypted queues until recipient delivery.
              </p>
            </div>

            {/* 5. Contact Discovery */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Contact Discovery
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px]">
                  {contactDiscovery ? "Client-Side Hashed" : "Disabled"}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[90%]" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Address book entries are hashed with SHA-256 locally before matching. Zero raw numbers stored.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: What the Server Can & Cannot Access */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            What The Server Can Access
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            We believe in complete technical transparency without misleading claims like &quot;100% untraceable&quot;. Here is our audited data access policy:
          </p>

          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
            <div className="p-3 flex items-center justify-between bg-slate-50/50">
              <span className="font-semibold text-slate-700">Message Plaintext</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                ❌ No Access
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Private Encryption Keys</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                ❌ No Access
              </span>
            </div>
            <div className="p-3 flex items-center justify-between bg-slate-50/50">
              <span className="font-semibold text-slate-700">Call Audio & Video Streams</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                ❌ No Access
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Permanent Chat Database</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                ❌ None (Zero Logs)
              </span>
            </div>
            <div className="p-3 flex items-center justify-between bg-slate-50/50">
              <span className="font-semibold text-slate-700">Temporary Encrypted Queue</span>
              <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md text-[11px]">
                ⚠️ Ephemeral (Purged on delivery)
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Basic Account Metadata</span>
              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                ℹ️ Required (Name, @handle)
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: One-Tap Privacy Cleanup ("Clean My Privacy") */}
        <div className="bg-white rounded-3xl border border-rose-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900">
              Clean My Privacy
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Instantly wipe all decrypted messages, call logs, cached peer keys, and search history from this device in one tap.
          </p>

          <button
            onClick={() => setShowCleanModal(true)}
            className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-2 border border-rose-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Open Cleanup Manager</span>
          </button>
        </div>

        {/* Section 4: Quick Navigation to Other Privacy Controls */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/settings/devices"
            className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition space-y-1 block"
          >
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Linked Devices</p>
            <p className="text-[10px] text-slate-400">Audit & revoke active device keys</p>
          </Link>

          <Link
            href="/settings/privacy"
            className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition space-y-1 block"
          >
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Privacy Preferences</p>
            <p className="text-[10px] text-slate-400">Presence, receipts, disappearing</p>
          </Link>
        </div>
      </main>

      {/* MODAL: Clean My Privacy Confirmation */}
      {showCleanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="h-9 w-9 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Clean My Privacy</h3>
                <p className="text-[10px] text-slate-400">Local Device Data Purge</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The following local artifacts will be permanently purged from this device:
            </p>

            <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Delete local decrypted chat history</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Delete WebRTC voice/video call records</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Delete downloaded ephemeral image cache</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Clear recent search query records</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanup}
                disabled={cleaning}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {cleaning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : cleanSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Purged!
                  </>
                ) : (
                  "CLEAN NOW"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
