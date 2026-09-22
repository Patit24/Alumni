"use client";

import { useState, useRef } from "react";
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
    department?: {
      name: string;
    } | null;
    batchYear?: number | null;
  };
}

export default function AlumniPassportCard({ user: initialUser }: AlumniPassportCardProps) {
  const [user, setUser] = useState(initialUser);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const quickAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const quickCoverInputRef = useRef<HTMLInputElement | null>(null);

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
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          setUser((prev) => ({ ...prev, coverUrl: compressed }));

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
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          setUser((prev) => ({ ...prev, avatarUrl: compressed }));

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

              {/* Instant Avatar Upload Button */}
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

              {/* Mobile Camera Indicator Badge */}
              <button
                type="button"
                onClick={() => quickAvatarInputRef.current?.click()}
                className="sm:hidden absolute bottom-0 left-0 p-1.5 rounded-full bg-slate-900 text-white ring-2 ring-white shadow-xs"
                title="Change profile picture"
              >
                <Camera className="w-3 h-3" />
              </button>

              {/* Verified Badge */}
              {isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 text-white ring-2 ring-white flex items-center justify-center shadow-xs"
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
                    : "bg-amber-50 text-amber-700 border border-amber-200/80"
                }`}
              >
                {isVerified ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Alumni</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>Awaiting Batch Vouch</span>
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
