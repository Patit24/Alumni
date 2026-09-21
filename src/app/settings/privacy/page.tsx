"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Eye,
  CheckCheck,
  Clock,
  Phone,
  UserX,
  Smartphone,
  Loader2,
  Check,
} from "lucide-react";

interface PrivacySettings {
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineStatus: boolean;
  lastSeen: boolean;
  allowCallsFrom: string;
  disappearingDefault: number;
}

interface BlockedUser {
  id: string;
  name: string;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
}

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings>({
    readReceipts: true,
    typingIndicators: true,
    onlineStatus: true,
    lastSeen: false,
    allowCallsFrom: "EVERYONE",
    disappearingDefault: 0,
  });
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    async function loadPrivacy() {
      try {
        setLoading(true);
        const [setRes, blkRes] = await Promise.all([
          fetch("/api/privacy/settings"),
          fetch("/api/privacy/block"),
        ]);

        if (setRes.ok) {
          const sData = await setRes.json();
          if (sData.settings) setSettings(sData.settings);
        }

        if (blkRes.ok) {
          const bData = await blkRes.json();
          if (bData.blockedUsers) setBlockedUsers(bData.blockedUsers);
        }
      } catch (err) {
        console.error("Failed to load privacy settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPrivacy();
  }, []);

  const updateSetting = async (key: keyof PrivacySettings, value: unknown) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      const res = await fetch("/api/privacy/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (res.ok) {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 2000);
      }
    } catch (err) {
      console.error("Error saving privacy setting:", err);
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/privacy/block?targetUserId=${targetUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      }
    } catch (err) {
      console.error("Error unblocking user:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Privacy & Security</h1>
              <p className="text-[11px] text-slate-400">Manage communication privacy & device access</p>
            </div>
          </div>

          {savedMessage && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Encryption Status Card */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">End-to-End Encryption Active</h2>
              <p className="text-[11px] text-slate-500">
                AES-256-GCM + NIST P-256 ECDH with device-stored keys
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            Messages and calls are secured with transport-level and payload-level encryption. The server
            never receives or stores plaintext message content or call media.
          </p>
        </div>

        {/* Messaging Privacy Toggles */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4 text-blue-600" /> Read Receipts
              </p>
              <p className="text-[11px] text-slate-500">
                Let others see when you have read their messages
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.readReceipts}
              onChange={(e) => updateSetting("readReceipts", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" /> Typing Indicators
              </p>
              <p className="text-[11px] text-slate-500">
                Show real-time typing status when composing messages
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.typingIndicators}
              onChange={(e) => updateSetting("typingIndicators", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Online Status</p>
              <p className="text-[11px] text-slate-500">
                Show active green indicator when using the app
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.onlineStatus}
              onChange={(e) => updateSetting("onlineStatus", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> Default Disappearing Messages
              </p>
              <p className="text-[11px] text-slate-500">
                Set automatic timer for newly started encrypted chats
              </p>
            </div>
            <select
              value={settings.disappearingDefault}
              onChange={(e) => updateSetting("disappearingDefault", parseInt(e.target.value, 10))}
              className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
            >
              <option value="0">Off</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="300">5m</option>
              <option value="3600">1h</option>
              <option value="86400">24h</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-indigo-600" /> Incoming Calls Permissions
              </p>
              <p className="text-[11px] text-slate-500">
                Who can initiate voice and video calls with you
              </p>
            </div>
            <select
              value={settings.allowCallsFrom}
              onChange={(e) => updateSetting("allowCallsFrom", e.target.value)}
              className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
            >
              <option value="EVERYONE">All Alumni</option>
              <option value="VERIFIED_ONLY">Verified Alumni Only</option>
              <option value="BATCH_ONLY">Same Batch Only</option>
            </select>
          </div>
        </div>

        {/* Linked Devices Shortcut */}
        <Link
          href="/settings/devices"
          className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Linked Devices</p>
              <p className="text-[11px] text-slate-500">View and revoke active cryptographic sessions</p>
            </div>
          </div>
          <span className="text-xs text-blue-600 font-bold group-hover:translate-x-0.5 transition">
            Manage →
          </span>
        </Link>

        {/* Blocked Users Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-600" />
            <h2 className="text-xs font-bold text-slate-900">Blocked Contacts ({blockedUsers.length})</h2>
          </div>

          {blockedUsers.length === 0 ? (
            <p className="text-xs text-slate-400">No contacts blocked.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {blockedUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{u.name}</p>
                    <p className="text-[10px] text-slate-400">Class of {u.batchYear}</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(u.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
