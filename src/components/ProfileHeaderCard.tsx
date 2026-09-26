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
  UserMinus,
} from "lucide-react";
import QRCodeModal from "@/components/QRCodeModal";
import QRScannerModal from "@/components/QRScannerModal";
import EditProfileModal from "@/components/EditProfileModal";
import {
  addLocalConnectedPeer,
  removeLocalConnectedPeer,
  getLocalConnectedPeerIds,
  setActiveVaultUser,
  cacheConnectionProfiles,
  getActiveVaultUserId,
} from "@/lib/e2ee/vault";
import { authFetch } from "@/lib/auth-fetch";

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
  const [user, setUser] = useState(() => {
    const cachedAvatar = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_avatar_${initialUser.id}`)
      : null;
    const cachedCover = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_cover_${initialUser.id}`)
      : null;
    const cachedInst = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_inst_${initialUser.id}`)
      : null;
    return {
      ...initialUser,
      avatarUrl: initialUser.avatarUrl || cachedAvatar || null,
      coverUrl: initialUser.coverUrl || cachedCover || null,
      institution: cachedInst
        ? { ...(initialUser.institution || {}), name: cachedInst }
        : initialUser.institution,
    };
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const quickAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const quickCoverInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when initialUser changes without wiping out cached avatar/cover
  useEffect(() => {
    const cachedAvatar = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_avatar_${initialUser.id}`)
      : null;
    const cachedCover = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_cover_${initialUser.id}`)
      : null;
    const cachedInst = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_inst_${initialUser.id}`)
      : null;

    setUser((prev) => ({
      ...initialUser,
      avatarUrl: initialUser.avatarUrl || cachedAvatar || prev.avatarUrl,
      coverUrl: initialUser.coverUrl || cachedCover || prev.coverUrl,
      institution: cachedInst
        ? { ...(initialUser.institution || {}), name: cachedInst }
        : initialUser.institution,
    }));
  }, [initialUser]);

  // Ensure active vault user is initialized
  useEffect(() => {
    if (currentUser?.id) {
      setActiveVaultUser(currentUser.id);
    }
  }, [currentUser?.id]);

  // Sync with client-side profile-updated events
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUser((prev) => {
          const updatedInstName = e.detail.institutionName || e.detail.institution?.name;
          const updatedInst = updatedInstName
            ? { ...(prev.institution || {}), name: updatedInstName, city: e.detail.city || prev.institution?.city }
            : prev.institution;
          return {
            ...prev,
            ...e.detail,
            institution: updatedInst,
          };
        });
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, []);

  const isOwnProfile = currentUser?.id === user.id;
  const isVerified = user.verificationStatus === "VERIFIED";

  // Clean title casing for city
  const formattedCity = user.city
    ? user.city.charAt(0).toUpperCase() + user.city.slice(1).toLowerCase()
    : null;

  // Direct fast cover upload with center-crop
  const handleQuickCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const targetW = 1200;
          const targetH = 460;
          const scale = Math.max(targetW / img.width, targetH / img.height);
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          const offsetX = (targetW - scaledW) / 2;
          const offsetY = (targetH - scaledH) / 2;

          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            setUser((prev) => ({ ...prev, coverUrl: compressed }));
            if (typeof window !== "undefined") {
              localStorage.setItem(`alumni_cover_${user.id}`, compressed);
              try {
                const stored = JSON.parse(localStorage.getItem("alumni_user") || "{}");
                stored.coverUrl = compressed;
                localStorage.setItem("alumni_user", JSON.stringify(stored));
              } catch {}
              window.dispatchEvent(new CustomEvent("profile-updated", { detail: { coverUrl: compressed } }));
            }

            const localToken = typeof window !== "undefined" ? localStorage.getItem("alumni_session_token") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (localToken) headers["Authorization"] = `Bearer ${localToken}`;

            await fetch("/api/profile", {
              method: "PUT",
              headers,
              body: JSON.stringify({ coverUrl: compressed }),
            });
          }
        } catch (err) {
          console.warn("Failed to persist cover upload:", err);
        } finally {
          setUploadingCover(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Direct fast avatar upload with center square crop
  const handleQuickAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadingAvatar(false);
      alert("Failed to read profile picture file. Please try another image.");
    };
    reader.onload = async (event) => {
      const img = new Image();
      img.onerror = () => {
        setUploadingAvatar(false);
        alert("Failed to process profile picture. Please select a valid JPG, PNG, or WebP image.");
      };
      img.onload = async () => {
        try {
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          const canvas = document.createElement("canvas");
          canvas.width = 400;
          canvas.height = 400;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 400, 400);
            const compressed = canvas.toDataURL("image/jpeg", 0.85);
            setUser((prev) => ({ ...prev, avatarUrl: compressed }));
            if (typeof window !== "undefined") {
              localStorage.setItem(`alumni_avatar_${user.id}`, compressed);
              try {
                const stored = JSON.parse(localStorage.getItem("alumni_user") || "{}");
                stored.avatarUrl = compressed;
                localStorage.setItem("alumni_user", JSON.stringify(stored));
              } catch {}
              window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatarUrl: compressed } }));
            }

            const localToken = typeof window !== "undefined" ? localStorage.getItem("alumni_session_token") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (localToken && localToken !== "null" && localToken !== "undefined") {
              headers["Authorization"] = `Bearer ${localToken}`;
            }

            const res = await fetch("/api/profile", {
              method: "PUT",
              headers,
              credentials: "include",
              body: JSON.stringify({ avatarUrl: compressed }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.warn("Avatar update server notice:", errData.error || res.statusText);
            } else {
              const resData = await res.json().catch(() => ({}));
              if (resData.token && typeof window !== "undefined") {
                localStorage.setItem("alumni_session_token", resData.token);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to persist avatar upload:", err);
          alert("Something went wrong while processing the photo. Please try again.");
        } finally {
          setUploadingAvatar(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const [relStatus, setRelStatus] = useState<"NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED">(() => {
    if (typeof window !== "undefined" && user?.id) {
      const uid = currentUser?.id || getActiveVaultUserId();
      const localPeers = getLocalConnectedPeerIds(uid || undefined);
      if (localPeers.includes(user.id)) return "CONNECTED";
    }
    return "NONE";
  });
  const [mutualCount, setMutualCount] = useState<number>(0);

  // Fetch true relationship status and mutual connections from server
  useEffect(() => {
    if (!currentUser || isOwnProfile) return;
    const uid = currentUser.id || getActiveVaultUserId();
    const fetchStatus = () => {
      const localPeers = getLocalConnectedPeerIds(uid || undefined);
      const isLocallyConnected = localPeers.includes(user.id);
      if (isLocallyConnected) {
        setRelStatus("CONNECTED");
      }
      const clientPeersQuery = isLocallyConnected ? user.id : "";
      const url = `/api/connections?targetUserId=${user.id}${clientPeersQuery ? `&clientPeers=${encodeURIComponent(clientPeersQuery)}` : ""}`;
      authFetch(url)
        .then((r) => r.json())
        .then((data) => {
          const rel = data.relationship;
          if (rel) {
            if (rel.status === "CONNECTED" || rel.isConnection) {
              setRelStatus("CONNECTED");
              if (uid) addLocalConnectedPeer(user.id, uid);
            } else if (rel.status === "PENDING_OUTGOING") {
              if (!isLocallyConnected) setRelStatus("PENDING_OUTGOING");
            } else if (rel.status === "PENDING_INCOMING") {
              if (!isLocallyConnected) setRelStatus("PENDING_INCOMING");
            } else {
              // Never downgrade to NONE if already locally known to be connected
              if (!isLocallyConnected) setRelStatus("NONE");
            }
            if (typeof rel.mutualCount === "number") {
              setMutualCount(rel.mutualCount);
            }
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
    setRelStatus("PENDING_OUTGOING");

    try {
      const res = await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "CONNECT" }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.relationship?.isConnection || data.relationship?.status === "CONNECTED") {
        setRelStatus("CONNECTED");
        const uid = currentUser.id || getActiveVaultUserId();
        if (uid) {
          addLocalConnectedPeer(user.id, uid);
          cacheConnectionProfiles([{
            id: user.id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
            batchYear: user.batchYear,
            currentRole: user.currentRole,
            currentCompany: user.currentCompany,
            city: user.city,
            verificationStatus: user.verificationStatus,
            institution: user.institution,
            department: user.department,
            connectedAt: new Date().toISOString(),
          }], uid);
        }
      } else {
        setRelStatus("PENDING_OUTGOING");
      }
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleAcceptConnect = async () => {
    setConnecting(true);
    setRelStatus("CONNECTED");
    const uid = currentUser?.id || getActiveVaultUserId();
    if (uid) {
      addLocalConnectedPeer(user.id, uid);
      cacheConnectionProfiles([{
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        batchYear: user.batchYear,
        currentRole: user.currentRole,
        currentCompany: user.currentCompany,
        city: user.city,
        verificationStatus: user.verificationStatus,
        institution: user.institution,
        department: user.department,
        connectedAt: new Date().toISOString(),
      }], uid);
    }
    try {
      const res = await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "ACCEPT" }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.relationship?.isConnection || data.relationship?.status === "CONNECTED") {
        setRelStatus("CONNECTED");
      }
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
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
      await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "IGNORE" }),
      });
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleCancelConnect = async () => {
    setConnecting(true);
    setRelStatus("NONE");
    try {
      await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "WITHDRAW" }),
      });
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleRemoveConnection = async () => {
    if (!confirm(`Are you sure you want to remove ${user.name} from your 1st-degree connections?`)) return;
    setConnecting(true);
    setRelStatus("NONE");
    if (currentUser?.id) {
      removeLocalConnectedPeer(user.id, currentUser.id);
    }
    try {
      await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, action: "REMOVE" }),
      });
      window.dispatchEvent(new CustomEvent("connection-requests-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleGoToChat = () => {
    if (currentUser?.id) {
      setActiveVaultUser(currentUser.id);
      if (relStatus === "CONNECTED") {
        addLocalConnectedPeer(user.id, currentUser.id);
      }
    }
    router.push(`/messages/${user.id}`);
  };

  return (
    <>
      {/* QR Code Scanned Connection Banner */}
      {autoConnect && !isOwnProfile && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold">Alumni QR Code Scanned</p>
              <p className="text-[11px] text-white/80">
                {relStatus === "CONNECTED"
                  ? `You and ${user.name} are already connected!`
                  : relStatus === "PENDING_OUTGOING"
                  ? `Connection request sent to ${user.name}. Messaging unlocks upon acceptance.`
                  : relStatus === "PENDING_INCOMING"
                  ? `${user.name} sent you a connection request! Accept to start chatting.`
                  : `Send a connection request to ${user.name} to connect and chat.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {relStatus === "CONNECTED" ? (
              <button
                type="button"
                onClick={handleGoToChat}
                className="px-4 py-2 rounded-xl bg-white text-emerald-800 text-xs font-bold shadow-xs hover:bg-emerald-50 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Tap to Message (SMS)</span>
              </button>
            ) : relStatus === "PENDING_OUTGOING" ? (
              <span className="px-3.5 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/30">
                <Clock className="w-3.5 h-3.5" />
                <span>Request Pending</span>
              </span>
            ) : relStatus === "PENDING_INCOMING" ? (
              <button
                type="button"
                onClick={handleAcceptConnect}
                disabled={connecting}
                className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-xs font-bold shadow-xs hover:bg-emerald-50 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{connecting ? "Accepting..." : "Accept Request"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendConnect}
                disabled={connecting}
                className="px-4 py-2 rounded-xl bg-white text-blue-700 text-xs font-bold shadow-xs hover:bg-blue-50 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>{connecting ? "Sending..." : "Send Connection Request"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-[#111726]/80 rounded-3xl border border-white/10 shadow-xl shadow-black/40 backdrop-blur-xl overflow-hidden text-white">
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
            <div className="w-full h-full bg-gradient-to-r from-[#0a0f1d] via-[#111726] to-[#0a0f1d] relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,153,51,0.22),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,128,0.25),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(19,136,8,0.18),transparent_50%)]" />
            </div>
          )}

          {isOwnProfile && (
            <>
              <button
                type="button"
                onClick={() => quickCoverInputRef.current?.click()}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border border-white/15"
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
          <div className="absolute bottom-3 left-4 hidden sm:flex items-center gap-2 text-white/90 text-xs font-medium tracking-wide drop-shadow-md">
            <Building className="w-3.5 h-3.5 text-[#FF9933]" />
            <span>{user.institution.name}</span>
          </div>

          <div className="absolute bottom-3 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 text-emerald-400 text-[11px] font-semibold backdrop-blur-md border border-emerald-500/30 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-5 sm:px-8 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div
                onClick={() => isOwnProfile && quickAvatarInputRef.current?.click()}
                className={`h-24 w-24 sm:h-28 sm:w-28 rounded-2xl ring-4 ring-white/10 bg-gradient-to-tr from-[#FF9933] via-orange-600 to-[#138808] text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-xl shadow-black/60 shrink-0 overflow-hidden select-none ${isOwnProfile ? "cursor-pointer" : ""}`}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Uploading Spinner Overlay */}
              {isOwnProfile && uploadingAvatar && (
                <div className="absolute inset-0 rounded-2xl bg-black/65 text-white flex flex-col items-center justify-center backdrop-blur-xs z-20">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-[10px] font-semibold mt-1.5">Uploading...</span>
                </div>
              )}

              {isOwnProfile && !uploadingAvatar && (
                <>
                  {/* Instant Avatar Upload Button (Desktop Hover Overlay) */}
                  <button
                    type="button"
                    onClick={() => quickAvatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer backdrop-blur-[2px] z-10"
                    title="Change profile picture"
                  >
                    <Camera className="w-6 h-6 drop-shadow-sm" />
                    <span className="text-[10px] font-bold mt-1 tracking-wide drop-shadow-sm">Change Photo</span>
                  </button>
                  <input
                    ref={quickAvatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleQuickAvatarUpload}
                    className="hidden"
                  />
                  {/* Always-Visible Camera Badge (Bottom-Left) */}
                  <button
                    type="button"
                    onClick={() => quickAvatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -left-1 p-2 rounded-xl bg-[#0a0f1d] hover:bg-black text-white ring-2 ring-white/15 border border-white/10 shadow-md hover:scale-110 active:scale-95 transition cursor-pointer flex items-center justify-center z-15 disabled:opacity-50"
                    title="Change profile picture"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                </>
              )}

              {isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 text-white ring-2 ring-[#0a0f1d] flex items-center justify-center shadow-xs z-15"
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
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="btn-saffron flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-md shadow-[#ff9933]/20 transition active:scale-95 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>My QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition active:scale-95 cursor-pointer"
                  >
                    <Scan className="w-3.5 h-3.5 text-orange-400" />
                    <span>Scan QR</span>
                  </button>
                </>
              ) : (
                /* Visiting Another Member's Profile -> Canonical Relationship Aware Button */
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {relStatus === "CONNECTED" ? (
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleGoToChat}
                        className="btn-saffron flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition active:scale-98 cursor-pointer shadow-xs"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveConnection}
                        disabled={connecting}
                        className="p-2.5 rounded-2xl bg-white/10 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Remove Connection"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : relStatus === "PENDING_OUTGOING" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge-saffron inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold">
                        <Clock className="w-4 h-4 text-[#c2410c]" />
                        <span>Pending</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelConnect}
                        disabled={connecting}
                        className="px-3.5 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition disabled:opacity-50 cursor-pointer"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : relStatus === "PENDING_INCOMING" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAcceptConnect}
                        disabled={connecting}
                        className="btn-india-green flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{connecting ? "Accepting..." : "Accept"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectConnect}
                        disabled={connecting}
                        className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold border border-white/10 transition active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        Ignore
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleSendConnect}
                        disabled={connecting}
                        className="btn-saffron flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{connecting ? "Connecting..." : "Connect"}</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 transition shrink-0 border border-white/10"
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
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {user.name}
              </h1>
              {!isOwnProfile && (
                relStatus === "CONNECTED" ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 1st
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-300 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">
                    {mutualCount > 0 ? "2nd" : "3rd"}
                  </span>
                )
              )}
              {user.username && (
                <span className="text-xs font-mono font-semibold text-blue-300 bg-[#000080]/30 border border-blue-500/30 px-2.5 py-0.5 rounded-lg">
                  @{user.username}
                </span>
              )}
              {isVerified && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Member</span>
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-orange-400 shrink-0" />
              <span>
                {user.currentRole && user.currentCompany
                  ? `${user.currentRole} at ${user.currentCompany}`
                  : user.currentRole || user.currentCompany || "Alumni Member"}
              </span>
            </p>

            {!isOwnProfile && mutualCount > 0 && (
              <p className="text-xs text-slate-300 flex items-center gap-1.5 pt-0.5">
                <Users className="w-3.5 h-3.5 text-[#FF9933] shrink-0" />
                <span className="text-[#FF9933] font-semibold">{mutualCount}</span>
                <span>mutual {mutualCount === 1 ? "connection" : "connections"}</span>
              </p>
            )}

            {/* Meta Chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs font-medium text-slate-400">
              {formattedCity && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formattedCity}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>{user.institution.name}</span>
              </span>

              {user.course && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30">
                  <span>{user.course}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                <span>Class of {user.batchYear} {user.department ? `(${user.department.name})` : ""}</span>
              </span>

              {!isOwnProfile && mutualCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{mutualCount} mutual connection{mutualCount > 1 ? "s" : ""}</span>
                </span>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-xs text-slate-300 pt-2 leading-relaxed italic border-t border-white/10">
                &ldquo;{user.bio}&rdquo;
              </p>
            )}

            {/* Social & Contact row */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2.5 text-xs">
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
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
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

      {/* Education & Batch Details Card (Dynamically reactive to profile edits & custom college) */}
      <div className="bg-[#111726]/80 rounded-3xl border border-white/10 p-6 shadow-xl shadow-black/40 backdrop-blur-xl space-y-4 text-white">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-blue-400" /> Education & Batch Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Institution</p>
            <p className="text-xs font-bold text-white mt-1">{user.institution?.name || "Not specified"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{user.institution?.city || formattedCity || "India"}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Graduation Batch</p>
            <p className="text-xs font-bold text-white mt-1">Class of {user.batchYear || "—"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Alumni Network Member</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Department / Degree</p>
            <p className="text-xs font-bold text-white mt-1">
              {user.course || user.department?.name || "General"}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Academic Degree</p>
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
        currentUser={currentUser}
      />

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          currentUser={user as any}
          onProfileUpdated={(updated) => {
            setUser((prev) => {
              const updatedInst =
                updated.institution ||
                (updated.institutionName ? { name: updated.institutionName, city: prev.institution?.city } : prev.institution);
              return {
                ...prev,
                ...updated,
                institution: updatedInst,
              };
            });
          }}
        />
      )}
    </>
  );
}
