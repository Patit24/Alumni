"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Building,
  Briefcase,
  MapPin,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Scan,
  Camera,
  CheckCircle2,
  Edit3,
  BookOpen,
} from "lucide-react";
import QRCodeModal from "@/components/QRCodeModal";
import QRScannerModal from "@/components/QRScannerModal";
import EditProfileModal from "@/components/EditProfileModal";

interface AlumniPassportCardProps {
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
    linkedinUrl?: string | null;
    institution?: {
      name: string;
    } | null;
    institutionName?: string | null;
    course?: string | null;
    department?: {
      name: string;
    } | null;
    batchYear?: number | null;
  };
}

export default function AlumniPassportCard({ user: initialUser }: AlumniPassportCardProps) {
  const [user, setUser] = useState(() => {
    const cachedAvatar = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_avatar_${initialUser.id}`)
      : null;
    const cachedCover = typeof window !== "undefined" && initialUser?.id
      ? localStorage.getItem(`alumni_cover_${initialUser.id}`)
      : null;
    return {
      ...initialUser,
      avatarUrl: initialUser.avatarUrl || cachedAvatar || null,
      coverUrl: initialUser.coverUrl || cachedCover || null,
    };
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

    setUser((prev) => ({
      ...initialUser,
      avatarUrl: initialUser.avatarUrl || cachedAvatar || prev.avatarUrl,
      coverUrl: initialUser.coverUrl || cachedCover || prev.coverUrl,
    }));
  }, [initialUser]);

  // Sync with client-side profile-updated events
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUser((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, []);

  const isVerified = user.verificationStatus === "VERIFIED";

  // Clean title casing for city
  const formattedCity = user.city
    ? user.city.charAt(0).toUpperCase() + user.city.slice(1).toLowerCase()
    : null;

  // Center-cropped landscape cover upload
  const handleQuickCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadingCover(false);
      alert("Failed to read the image file. Please try another image.");
    };
    reader.onload = async (event) => {
      const img = new Image();
      img.onerror = () => {
        setUploadingCover(false);
        alert("Failed to process image. Please choose a valid JPG or PNG file.");
      };
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

            // 1. Immediately update UI state
            setUser((prev) => ({ ...prev, coverUrl: compressed }));

            // 2. Persist in local storage
            if (typeof window !== "undefined") {
              localStorage.setItem(`alumni_cover_${user.id}`, compressed);
              try {
                const stored = JSON.parse(localStorage.getItem("alumni_user") || "{}");
                stored.coverUrl = compressed;
                localStorage.setItem("alumni_user", JSON.stringify(stored));
              } catch {}
              window.dispatchEvent(
                new CustomEvent("profile-updated", { detail: { coverUrl: compressed } })
              );
            }

            // 3. Save to server database with Bearer auth header
            const localToken = typeof window !== "undefined" ? localStorage.getItem("alumni_session_token") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (localToken && localToken !== "null" && localToken !== "undefined") {
              headers["Authorization"] = `Bearer ${localToken}`;
            }

            const res = await fetch("/api/profile", {
              method: "PUT",
              headers,
              credentials: "include",
              body: JSON.stringify({ coverUrl: compressed }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.warn("Cover update notice:", errData.error || res.statusText);
            } else {
              const resData = await res.json().catch(() => ({}));
              if (resData.token && typeof window !== "undefined") {
                localStorage.setItem("alumni_session_token", resData.token);
              }
            }
          }
        } catch (err) {
          console.warn("Cover photo upload error:", err);
        } finally {
          setUploadingCover(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Center-cropped square avatar upload
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
          // Crop square from center of image
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

            // 1. Immediately update UI state
            setUser((prev) => ({ ...prev, avatarUrl: compressed }));

            // 2. Persist in local storage
            if (typeof window !== "undefined") {
              localStorage.setItem(`alumni_avatar_${user.id}`, compressed);
              try {
                const stored = JSON.parse(localStorage.getItem("alumni_user") || "{}");
                stored.avatarUrl = compressed;
                localStorage.setItem("alumni_user", JSON.stringify(stored));
              } catch {}
              window.dispatchEvent(
                new CustomEvent("profile-updated", { detail: { avatarUrl: compressed } })
              );
            }

            // 3. Save to server database with Bearer auth header & cookie
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
          console.warn("Avatar upload error:", err);
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

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Cover Banner with Option to Change Cover */}
        <div className="h-32 sm:h-44 relative overflow-hidden group">
          {user.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.coverUrl}
              alt="Profile Cover"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.25),transparent_50%)]" />
            </div>
          )}

          {/* Change Cover Photo Button */}
          <button
            type="button"
            onClick={() => quickCoverInputRef.current?.click()}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/50 hover:bg-black/70 text-white text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 shadow-sm active:scale-95"
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

          {/* Banner Labels */}
          <div className="absolute bottom-3 left-4 hidden sm:flex items-center gap-2 text-white/80 text-xs font-medium tracking-wide drop-shadow-md">
            <Building className="w-3.5 h-3.5 text-indigo-300" />
            <span>Verified Alumni Passport</span>
          </div>

          <div className="absolute bottom-3 right-4 flex items-center gap-2">
            <Link
              href="/settings/privacy/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 hover:bg-black/60 text-white/95 text-[11px] font-medium backdrop-blur-md border border-white/20 transition shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </Link>
          </div>
        </div>

        {/* Profile Details Container (Overlapping the Banner) */}
        <div className="px-5 sm:px-8 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Avatar with Camera Overlay & Floating Verified Check Badge */}
            <div className="relative group shrink-0">
              <div
                onClick={() => quickAvatarInputRef.current?.click()}
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl ring-4 ring-white bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-lg shadow-slate-900/15 shrink-0 overflow-hidden select-none cursor-pointer"
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
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-2xl bg-black/65 text-white flex flex-col items-center justify-center backdrop-blur-xs z-20">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-[10px] font-semibold mt-1.5">Uploading...</span>
                </div>
              )}

              {/* Instant Avatar Upload Button (Desktop Hover Overlay) */}
              {!uploadingAvatar && (
                <button
                  type="button"
                  onClick={() => quickAvatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer backdrop-blur-[2px] z-10"
                  title="Upload profile picture"
                >
                  <Camera className="w-6 h-6 drop-shadow-sm" />
                  <span className="text-[10px] font-bold mt-1 tracking-wide drop-shadow-sm">Change Photo</span>
                </button>
              )}

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
                className="absolute -bottom-1 -left-1 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white ring-2 ring-white shadow-md hover:scale-110 active:scale-95 transition cursor-pointer flex items-center justify-center z-15 disabled:opacity-50"
                title="Change profile picture"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Verified Badge (Bottom-Right) */}
              {isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 text-white ring-2 ring-white flex items-center justify-center shadow-xs z-15"
                  title="Verified Alumni Member"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Action Buttons: [Edit Profile] [My QR] [Scan QR] */}
            <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 flex-wrap">
              {/* 1. Edit Profile */}
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              {/* 2. My QR Code */}
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 transition active:scale-98 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                <span>My QR</span>
              </button>

              {/* 3. Scan QR (Separated dedicated button in suitable place) */}
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition active:scale-98 cursor-pointer border border-slate-200/60"
              >
                <Scan className="w-3.5 h-3.5 text-blue-600" />
                <span>Scan QR</span>
              </button>
            </div>
          </div>

          {/* Typography & Profile Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {user.name}
              </h1>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isVerified
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                    : "bg-slate-100 text-slate-700 border border-slate-200/80"
                }`}
              >
                {isVerified ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Alumni</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Community Member</span>
                  </>
                )}
              </span>
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

              {user.institution && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user.institution.name}</span>
                </span>
              )}

              {user.course && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{user.course}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Class of {user.batchYear || 2026}
                  {user.department?.name ? ` (${user.department.name})` : ""}
                </span>
              </span>
            </div>

            {/* Bio Snippet if exists */}
            {user.bio && (
              <p className="text-xs text-slate-600 pt-1.5 leading-relaxed italic">
                &ldquo;{user.bio}&rdquo;
              </p>
            )}
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
        currentUser={user}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentUser={user}
        onProfileUpdated={(updated) => {
          setUser((prev) => ({ ...prev, ...updated }));
        }}
      />
    </>
  );
}
