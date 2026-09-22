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
  RefreshCw,
  Zap,
  Sliders,
  Radio,
  Sparkles,
  AlertTriangle,
  BellOff,
  Scan,
  School,
  GraduationCap,
} from "lucide-react";

interface PrivacySettings {
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineStatus: boolean;
  lastSeen: boolean;
  allowCallsFrom: string;
  disappearingDefault: number;
  privacyLockActive?: boolean;
  ghostNotifications?: boolean;
  screenshotAlert?: boolean;
  contactDiscoveryEnabled?: boolean;
  presenceVisibility?: string;
  showInstitution?: boolean;
  allowInstitutionDiscovery?: boolean;
  showCourse?: boolean;
  showGraduationYear?: boolean;
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
    privacyLockActive: false,
    ghostNotifications: true,
    screenshotAlert: true,
    contactDiscoveryEnabled: true,
    presenceVisibility: "LIMITED",
    showInstitution: true,
    allowInstitutionDiscovery: true,
    showCourse: true,
    showGraduationYear: true,
  });
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);

  // Identity Rotation State
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [customHandle, setCustomHandle] = useState("");
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrivacy() {
      try {
        setLoading(true);
        const [setRes, blkRes, meRes] = await Promise.all([
          fetch("/api/privacy/settings"),
          fetch("/api/privacy/block"),
          fetch("/api/auth/me"),
        ]);

        if (setRes.ok) {
          const sData = await setRes.json();
          if (sData.settings) setSettings(sData.settings);
        }

        if (blkRes.ok) {
          const bData = await blkRes.json();
          if (bData.blockedUsers) setBlockedUsers(bData.blockedUsers);
        }

        if (meRes.ok) {
          const mData = await meRes.json();
          if (mData?.user?.username) setCurrentUsername(mData.user.username);
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

  const handleRotateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setRotating(true);
    setRotateError(null);
    setRotateSuccess(null);

    try {
      const res = await fetch("/api/identity/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedUsername: customHandle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate identity");
      }

      setCurrentUsername(data.newUsername);
      setRotateSuccess(`Identity updated to @${data.newUsername}`);
      setTimeout(() => {
        setShowRotateModal(false);
        setRotateSuccess(null);
        setCustomHandle("");
      }, 1800);
    } catch (err: any) {
      setRotateError(err.message || "Failed to rotate identity");
    } finally {
      setRotating(false);
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

          <div className="flex items-center gap-2">
            {savedMessage && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <Link
              href="/settings/privacy/dashboard"
              className="py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200/80 transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Encryption Status Card */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900">End-to-End Encryption Active</h2>
                <p className="text-[11px] text-slate-500">
                  Protected with device-stored keys
                </p>
              </div>
            </div>
            <Link
              href="/settings/privacy/dashboard"
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Privacy Dashboard →
            </Link>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            Messages and calls are end-to-end encrypted on your device. Only you and your recipient hold the decryption keys.
          </p>
        </div>

        {/* SECTION 1: Identity & Public Discovery */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Identity & Discovery
          </h2>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Public Discovery Handle</p>
              <p className="text-sm font-bold font-mono text-blue-700">@{currentUsername || "alumni"}</p>
            </div>
            <button
              onClick={() => setShowRotateModal(true)}
              className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Rotate Identity</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Contact Discovery Matching</p>
              <p className="text-[11px] text-slate-500">
                Allow batchmates with your phone number to discover you via client-side salted SHA-256 matching
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.contactDiscoveryEnabled ?? true}
              onChange={(e) => updateSetting("contactDiscoveryEnabled", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SECTION: School / College Discovery & Academic Privacy */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <School className="w-4 h-4 text-blue-600" /> Institution & Academic Discovery
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Manage how your school or university is displayed and whether peers can discover your profile
            </p>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Institution Discovery</p>
              <p className="text-[11px] text-slate-500">
                Allow people from your school or university to find and connect with you under &quot;People from your Institution&quot;
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowInstitutionDiscovery ?? true}
              onChange={(e) => updateSetting("allowInstitutionDiscovery", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Show Institution on Profile</p>
              <p className="text-[11px] text-slate-500">
                Display your selected school or university publicly on your profile
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showInstitution ?? true}
              onChange={(e) => updateSetting("showInstitution", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Show Course / Degree</p>
              <p className="text-[11px] text-slate-500">
                Display your course or degree (e.g. BCA, B.Tech) on your profile card
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showCourse ?? true}
              onChange={(e) => updateSetting("showCourse", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Show Graduation Year</p>
              <p className="text-[11px] text-slate-500">
                Display your class or graduation year on your profile
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showGraduationYear ?? true}
              onChange={(e) => updateSetting("showGraduationYear", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SECTION 2: Ghost Notifications & Screen Awareness */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <BellOff className="w-4 h-4 text-purple-600" /> Ghost Notifications
              </p>
              <p className="text-[11px] text-slate-500">
                Show generic alerts (&quot;New message&quot;, &quot;Incoming private call&quot;) with zero sender or text previews on lock screen
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.ghostNotifications ?? true}
              onChange={(e) => updateSetting("ghostNotifications", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-amber-600" /> Screen Capture Awareness
              </p>
              <p className="text-[11px] text-slate-500">
                Display a discreet in-app alert when window blur or screen recording heuristics are detected
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.screenshotAlert ?? true}
              onChange={(e) => updateSetting("screenshotAlert", e.target.checked)}
              className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SECTION 3: Presence & Messaging Controls */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-600" /> Online Status Visibility
              </p>
              <p className="text-[11px] text-slate-500">
                Control who can see your live activity state
              </p>
            </div>
            <select
              value={settings.presenceVisibility || "LIMITED"}
              onChange={(e) => updateSetting("presenceVisibility", e.target.value)}
              className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
            >
              <option value="EVERYONE">Everyone</option>
              <option value="CONTACTS">Contacts Only</option>
              <option value="TRUSTED">Trusted Contacts Only</option>
              <option value="CHATTING_ONLY">While Chatting Only</option>
              <option value="NOBODY">Nobody (Invisible)</option>
            </select>
          </div>

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
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> Default Disappearing Messages
              </p>
              <p className="text-[11px] text-slate-500">
                Set automatic expiration for newly initiated encrypted chats
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
                Who can initiate WebRTC voice and video calls with you
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

      {/* MODAL: Rotate Identity */}
      {showRotateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rotate Public Identity</h3>
                <p className="text-[10px] text-slate-400">Generate a new discovery handle</p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900 space-y-1">
              <p className="font-bold">What happens when you rotate:</p>
              <ul className="list-disc pl-4 text-[11px] text-blue-800/80 space-y-0.5">
                <li>Your old handle stops resolving for new discovery searches.</li>
                <li>Your existing encrypted chats continue uninterrupted (device keys do not change).</li>
              </ul>
            </div>

            {rotateError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
                {rotateError}
              </div>
            )}

            {rotateSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>{rotateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRotateIdentity} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  New Handle (Leave empty for random):
                </label>
                <input
                  type="text"
                  placeholder="e.g. patit_9k2m"
                  value={customHandle}
                  onChange={(e) => setCustomHandle(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRotateModal(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rotating}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rotate Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
