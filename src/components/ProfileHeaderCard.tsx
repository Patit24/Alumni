"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building,
  GraduationCap,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  Lock,
  Camera,
  QrCode,
  Scan,
  Edit3,
  ExternalLink,
  Phone,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  UserPlus,
  Users,
  Clock,
} from "lucide-react";
import QRCodeModal from "@/components/QRCodeModal";
import QRScannerModal from "@/components/QRScannerModal";
import EditProfileModal from "@/components/EditProfileModal";
import { addLocalConnectedPeer } from "@/lib/e2ee/vault";

interface ProfileHeaderCardProps {
  user: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    bio?: string | null;
    role?: string;
    verificationStatus?: string;
    currentRole?: string | null;
    currentCompany?: string | null;
    city?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    isPhoneVisible?: boolean;
    course?: string | null;
    institution: {
      name: string;
      city?: string | null;
    };
    department?: {
      name: string;
    } | null;
    batchYear: number;
  };
  currentUser: {
    id: string;
    name: string;
  } | null;
  autoConnect?: boolean;
}

export default function ProfileHeaderCard({
  user: initialUser,
  currentUser,
  autoConnect = false,
}: ProfileHeaderCardProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const quickAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const quickCoverInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when initialUser changes
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  // Sync with client-side localStorage fallback so avatar/cover NEVER vanishes on refresh
  useEffect(() => {
    if (typeof window === "undefined" || !initialUser?.id) return;
    const cachedAvatar = localStorage.getItem(`alumni_avatar_${initialUser.id}`);
    const cachedCover = localStorage.getItem(`alumni_cover_${initialUser.id}`);
    if ((cachedAvatar && !initialUser.avatarUrl) || (cachedCover && !initialUser.coverUrl)) {
      setUser((prev) => ({
        ...prev,
        avatarUrl: prev.avatarUrl || cachedAvatar,
        coverUrl: prev.coverUrl || cachedCover,
      }));
    }

    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUser((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, [initialUser?.id, initialUser?.avatarUrl, initialUser?.coverUrl]);

  const isOwnProfile = currentUser?.id === user.id;
  const isVerified = user.verificationStatus === "VERIFIED";

  // Clean title casing for city
  const formattedCity = user.city
    ? user.city.charAt(0).toUpperCase() + user.city.slice(1).toLowerCase()
    : null;

  // Direct fast cover upload
  const handleQuickCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const maxWidth = 1200;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.78);
          setUser((prev) => ({ ...prev, coverUrl: compressed }));
          if (typeof window !== "undefined") {
            localStorage.setItem(`alumni_cover_${user.id}`, compressed);
            window.dispatchEvent(new CustomEvent("profile-updated", { detail: { coverUrl: compressed } }));
          }

          try {
            await fetch("/api/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ coverUrl: compressed }),
            });
          } catch (err) {
            console.warn("Failed to persist cover upload:", err);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Direct fast avatar upload
  const handleQuickAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const maxWidth = 400;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.78);
          setUser((prev) => ({ ...prev, avatarUrl: compressed }));
          if (typeof window !== "undefined") {
            localStorage.setItem(`alumni_avatar_${user.id}`, compressed);
            window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatarUrl: compressed } }));
          }

          try {
            await fetch("/api/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ avatarUrl: compressed }),
            });
          } catch (err) {
            console.warn("Failed to persist avatar upload:", err);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [relStatus, setRelStatus] = useState<"NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED">("NONE");
  const [mutualCount, setMutualCount] = useState<number>(0);

  // Fetch true relationship status and mutual connections from server
  useEffect(() => {
    if (!currentUser || isOwnProfile) return;
    const fetchStatus = () => {
      fetch(`/api/contacts/requests?targetUserId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.statusMap && data.statusMap[user.id]) {
            setRelStatus(data.statusMap[user.id]);
          } else {
            setRelStatus("NONE");
          }
          if (typeof data.mutualCount === "number") {
            setMutualCount(data.mutualCount);
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    window.addEventListener("connection-requests-updated", fetchStatus);
    return () => window.removeEventListener("connection-requests-updated", fetchStatus);
  }, [currentUser, isOwnProfile, user.id]);

  const handleSendConnect = async () => {
    if (!currentUser) {
      router.push(`/auth?redirect=/profile/${user.id}?connect=true`);
      return;
    }
    setConnecting(true);
    // Optimistic UI update: Immediately mark as Request Sent
    setRelStatus("PENDING_OUTGOING");

    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "REQUEST" }),
      });
      const data = await res.json();
      if (data.status === "ACCEPTED") {
        setRelStatus("CONNECTED");
        addLocalConnectedPeer(user.id);
      } else if (data.status === "PENDING") {
        setRelStatus("PENDING_OUTGOING");
      }
    } catch (err) {
      console.error(err);
      fetch(`/api/contacts/requests?targetUserId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.statusMap) setRelStatus(data.statusMap[user.id] || "NONE");
        });
    } finally {
      setConnecting(false);
    }
  };

  const handleAcceptConnect = async () => {
    setConnecting(true);
    setRelStatus("CONNECTED");
    try {
      const res = await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "ACCEPT" }),
      });
      const data = await res.json();
      if (data.status === "ACCEPTED") {
        setRelStatus("CONNECTED");
        addLocalConnectedPeer(user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleRejectConnect = async () => {
    setConnecting(true);
    setRelStatus("NONE");
    try {
      await fetch("/api/contacts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "REJECT" }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleGoToChat = () => {
    addLocalConnectedPeer(user.id);
    router.push(`/messages/${user.id}`);
  };

  const handleConnectForChat = async () => {
    if (relStatus === "CONNECTED") {
      handleGoToChat();
    } else if (relStatus === "PENDING_INCOMING") {
      await handleAcceptConnect();
      handleGoToChat();
    } else {
      await handleSendConnect();
      handleGoToChat();
    }
  };

  return (
    <>
      {/* Auto Connect scanned banner */}
      {autoConnect && !isOwnProfile && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold">QR Code Scanned Successfully</p>
              <p className="text-[11px] text-white/80">
                You found {user.name}&apos;s profile! Connect below to start encrypted chat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnectForChat}
            disabled={connecting}
            className="px-4 py-2 rounded-xl bg-white text-blue-700 text-xs font-bold shadow-xs hover:bg-blue-50 transition shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Connect & Chat</span>
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Cover Banner */}
        <div className="h-32 sm:h-44 relative overflow-hidden group">
          {user.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.coverUrl}
              alt="Profile Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.25),transparent_50%)]" />
            </div>
          )}

          {isOwnProfile && (
            <>
              <button
                type="button"
                onClick={() => quickCoverInputRef.current?.click()}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/50 hover:bg-black/70 text-white text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                title="Change cover picture"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Change Cover</span>
              </button>
              <input
                ref={quickCoverInputRef}
                type="file"
                accept="image/*"
                onChange={handleQuickCoverUpload}
                className="hidden"
              />
            </>
          )}

          {/* Banner Labels */}
          <div className="absolute bottom-3 left-4 hidden sm:flex items-center gap-2 text-white/80 text-xs font-medium tracking-wide drop-shadow-md">
            <Building className="w-3.5 h-3.5 text-indigo-300" />
            <span>{user.institution.name}</span>
          </div>

          <div className="absolute bottom-3 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 text-white/95 text-[11px] font-medium backdrop-blur-md border border-white/20 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-5 sm:px-8 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl ring-4 ring-white bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-lg shadow-slate-900/15 shrink-0 overflow-hidden select-none">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>

              {isOwnProfile && (
                <>
                  <button
                    type="button"
                    onClick={() => quickAvatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-2xs"
                    title="Change profile picture"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-bold mt-1">Change</span>
                  </button>
                  <input
                    ref={quickAvatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQuickAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => quickAvatarInputRef.current?.click()}
                    className="sm:hidden absolute bottom-0 left-0 p-1.5 rounded-full bg-slate-900 text-white ring-2 ring-white shadow-xs cursor-pointer"
                    title="Change profile picture"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </>
              )}

              {isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 text-white ring-2 ring-white flex items-center justify-center shadow-xs"
                  title="Verified Alumni Member"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Actions for Own Profile vs Other Alumni */}
            <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 flex-wrap">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 transition active:scale-98 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>My QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition active:scale-98 cursor-pointer border border-slate-200/60"
                  >
                    <Scan className="w-3.5 h-3.5 text-blue-600" />
                    <span>Scan QR</span>
                  </button>
                </>
              ) : (
                /* Visiting Another Member's Profile -> Relationship Aware Button */
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {relStatus === "CONNECTED" ? (
                    <button
                      type="button"
                      onClick={handleGoToChat}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-98 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Message</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : relStatus === "PENDING_OUTGOING" ? (
                    <span className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 transition">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Request Sent</span>
                    </span>
                  ) : relStatus === "PENDING_INCOMING" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAcceptConnect}
                        disabled={connecting}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{connecting ? "Accepting..." : "Accept"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectConnect}
                        disabled={connecting}
                        className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200/80 transition active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleSendConnect}
                        disabled={connecting}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-98 cursor-pointer ring-2 ring-blue-500/30 disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{connecting ? "Connecting..." : "Connect"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGoToChat}
                        className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-98 cursor-pointer flex items-center gap-1.5"
                        title="Direct Message"
                      >
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="hidden xs:inline">Message</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
                    title="View QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Typography & Profile Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {user.name}
              </h1>
              {user.username && (
                <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  @{user.username}
                </span>
              )}
              {isVerified && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Member</span>
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {user.currentRole && user.currentCompany
                  ? `${user.currentRole} at ${user.currentCompany}`
                  : user.currentRole || user.currentCompany || "Alumni Member"}
              </span>
            </p>

            {/* Meta Chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs font-medium text-slate-500">
              {formattedCity && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formattedCity}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>{user.institution.name}</span>
              </span>

              {user.course && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <span>{user.course}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>Class of {user.batchYear} {user.department ? `(${user.department.name})` : ""}</span>
              </span>

              {!isOwnProfile && mutualCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{mutualCount} mutual connection{mutualCount > 1 ? "s" : ""}</span>
                </span>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-xs text-slate-600 pt-2 leading-relaxed italic border-t border-slate-100">
                &ldquo;{user.bio}&rdquo;
              </p>
            )}

            {/* Social & Contact row */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
              {user.linkedinUrl && (
                <a
                  href={user.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0a66c2] text-white font-medium hover:bg-[#084e96] transition"
                >
                  LinkedIn Profile <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {user.phone && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {isOwnProfile || user.isPhoneVisible ? (
                    <span>{user.phone}</span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Lock className="w-3 h-3" /> Phone hidden
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        currentUser={user}
        onOpenScanner={() => setShowScannerModal(true)}
      />

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onOpenMyQr={() => {
          setShowScannerModal(false);
          setShowQrModal(true);
        }}
      />

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          currentUser={user as any}
          onProfileUpdated={(updated) => {
            setUser((prev) => ({ ...prev, ...updated }));
          }}
        />
      )}
    </>
  );
}
