"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Camera,
  Upload,
  Building,
  Briefcase,
  MapPin,
  FileText,
  Globe,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  School,
  GraduationCap,
  BookOpen,
  Search,
} from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    bio?: string | null;
    currentCompany?: string | null;
    currentRole?: string | null;
    city?: string | null;
    linkedinUrl?: string | null;
    institution?: { name: string } | null;
    institutionName?: string | null;
    department?: { name: string } | null;
    departmentName?: string | null;
    course?: string | null;
    batchYear?: number | null;
  };
  onProfileUpdated?: (updated: any) => void;
}

const COVER_PRESETS = [
  {
    name: "Campus Arch",
    url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Tech Innovation",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "University Quad",
    url: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Executive Blue",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: EditProfileModalProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(currentUser.name || "");
  const [currentRole, setCurrentRole] = useState(currentUser.currentRole || "");
  const [currentCompany, setCurrentCompany] = useState(currentUser.currentCompany || "");
  const [city, setCity] = useState(currentUser.city || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [linkedinUrl, setLinkedinUrl] = useState(currentUser.linkedinUrl || "");
  const [institutionName, setInstitutionName] = useState(
    currentUser.institution?.name || currentUser.institutionName || ""
  );
  const [departmentName, setDepartmentName] = useState(
    currentUser.department?.name || currentUser.departmentName || ""
  );
  const [course, setCourse] = useState(currentUser.course || "");
  const [batchYear, setBatchYear] = useState<string>(
    currentUser.batchYear ? String(currentUser.batchYear) : ""
  );
  const [instType, setInstType] = useState<"COLLEGE" | "SCHOOL">(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (currentUser as any).institution?.type === "SCHOOL" ? "SCHOOL" : "COLLEGE"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(currentUser.coverUrl || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync form fields when modal opens or currentUser updates
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || "");
      setCurrentRole(currentUser.currentRole || "");
      setCurrentCompany(currentUser.currentCompany || "");
      setCity(currentUser.city || "");
      setBio(currentUser.bio || "");
      setLinkedinUrl(currentUser.linkedinUrl || "");
      setInstitutionName(currentUser.institution?.name || currentUser.institutionName || "");
      setDepartmentName(currentUser.department?.name || currentUser.departmentName || "");
      setCourse(currentUser.course || "");
      setBatchYear(currentUser.batchYear ? String(currentUser.batchYear) : "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInstType((currentUser as any).institution?.type === "SCHOOL" ? "SCHOOL" : "COLLEGE");

      const cachedAvatar = typeof window !== "undefined" && currentUser?.id
        ? localStorage.getItem(`alumni_avatar_${currentUser.id}`)
        : null;
      setAvatarUrl(currentUser.avatarUrl || cachedAvatar || null);

      const cachedCover = typeof window !== "undefined" && currentUser?.id
        ? localStorage.getItem(`alumni_cover_${currentUser.id}`)
        : null;
      setCoverUrl(currentUser.coverUrl || cachedCover || null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, currentUser]);

  // Institution suggestions
  const [instSuggestions, setInstSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Search colleges when typing
  useEffect(() => {
    const q = institutionName.trim();
    if (!q || q.length < 2) {
      setInstSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/institutions?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setInstSuggestions(data.institutions || []);
      } catch {
        setInstSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [institutionName]);

  // Compress & center-crop selected file to base64
  const processImageFile = (file: File, isSquare: boolean, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onerror = () => {
      setError("Failed to read image file. Please try another image.");
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        setError("Failed to process image. Please select a valid JPG, PNG, or WebP file.");
      };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (isSquare) {
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;
          canvas.width = 400;
          canvas.height = 400;
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 400, 400);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          callback(compressed);
        } else {
          const targetW = 1200;
          const targetH = 460;
          const scale = Math.max(targetW / img.width, targetH / img.height);
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          const offsetX = (targetW - scaledW) / 2;
          const offsetY = (targetH - scaledH) / 2;
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          callback(compressed);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, true, (dataUrl) => {
        setAvatarUrl(dataUrl);
      });
    }
    e.target.value = "";
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, false, (dataUrl) => {
        setCoverUrl(dataUrl);
      });
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const localToken = typeof window !== "undefined" ? localStorage.getItem("alumni_session_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (localToken && localToken !== "null" && localToken !== "undefined") {
        headers["Authorization"] = `Bearer ${localToken}`;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl,
          coverUrl,
          bio: bio.trim() || null,
          currentRole: currentRole.trim() || null,
          currentCompany: currentCompany.trim() || null,
          city: city.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          institutionName: institutionName.trim() || null,
          institutionType: instType,
          departmentName: departmentName.trim() || null,
          course: course.trim() || null,
          batchYear: batchYear.trim() && !isNaN(Number(batchYear.trim())) ? parseInt(batchYear.trim(), 10) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (typeof window !== "undefined") {
        if (data.token) {
          localStorage.setItem("alumni_session_token", data.token);
        }
        if (currentUser?.id) {
          if (avatarUrl) localStorage.setItem(`alumni_avatar_${currentUser.id}`, avatarUrl);
          if (coverUrl) localStorage.setItem(`alumni_cover_${currentUser.id}`, coverUrl);
          try {
            const stored = JSON.parse(localStorage.getItem("alumni_user") || "{}");
            if (avatarUrl) stored.avatarUrl = avatarUrl;
            if (coverUrl) stored.coverUrl = coverUrl;
            localStorage.setItem("alumni_user", JSON.stringify(stored));
          } catch {}
          const savedInstName = data.user?.institution?.name || institutionName.trim();
          if (savedInstName) {
            localStorage.setItem(`alumni_inst_${currentUser.id}`, savedInstName);
          }
          window.dispatchEvent(
            new CustomEvent("profile-updated", {
              detail: {
                ...(data.user || {}),
                institution: data.user?.institution || { name: savedInstName, city: city.trim() || null },
                institutionName: savedInstName,
                avatarUrl: avatarUrl || data.user?.avatarUrl,
                coverUrl: coverUrl || data.user?.coverUrl,
              },
            })
          );
        }
      }

      setSuccess(true);
      if (onProfileUpdated) {
        onProfileUpdated(data.user);
      }
      try {
        router.refresh();
      } catch {}

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setError(err.message || "Failed to save profile changes");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0a0f1d] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white backdrop-blur-xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0f1d] sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-white">Edit Alumni Profile</h2>
            <p className="text-xs text-slate-400">Update photo, cover, role, and location</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* 1. COVER PICTURE SELECTION */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Cover Picture</span>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1 normal-case"
                >
                  <Trash2 className="w-3 h-3" /> Reset to Gradient
                </button>
              )}
            </label>

            {/* Cover Preview Card */}
            <div className="relative h-28 sm:h-32 w-full rounded-2xl overflow-hidden border border-white/10 group bg-gradient-to-r from-slate-950 via-[#111726] to-slate-950">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-medium">
                  Default Midnight Gradient Banner
                </div>
              )}

              {/* Cover Upload Button Overlay */}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 shadow-sm border border-white/15"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Cover Photo</span>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
            </div>

            {/* Quick Preset Covers */}
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1.5">Or choose a campus cover:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setCoverUrl(preset.url)}
                    className={`h-12 rounded-xl overflow-hidden relative border transition group text-left ${
                      coverUrl === preset.url ? "ring-2 ring-[#FF9933] border-transparent" : "border-white/10"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/40 flex items-end p-1 text-[9px] font-bold text-white leading-tight">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. PROFILE PICTURE (AVATAR) SELECTION */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Profile Picture
            </label>

            <div className="flex items-center gap-4">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative cursor-pointer group shrink-0"
              >
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-[#FF9933] via-orange-600 to-[#138808] text-white flex items-center justify-center font-black text-2xl shadow-md overflow-hidden ring-4 ring-white/10 transition group-hover:ring-[#FF9933]/50">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    name.charAt(0).toUpperCase() || "A"
                  )}
                </div>
                <div
                  className="absolute inset-0 rounded-2xl bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"
                  title="Upload profile photo"
                >
                  <Camera className="w-5 h-5 drop-shadow-sm" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                  className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#FF9933] hover:bg-orange-500 text-white shadow-md transition hover:scale-110 active:scale-95 cursor-pointer ring-2 ring-[#0a0f1d]"
                  title="Upload profile photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition active:scale-98 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition active:scale-98 cursor-pointer border border-rose-500/30"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  JPG, PNG, or WebP. Square photo works best.
                </p>
              </div>
            </div>
          </div>

          {/* 3. PROFILE DETAILS */}
          <div className="space-y-3.5 pt-2 border-t border-white/10">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Personal & Professional Details
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full p-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] font-medium transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Current Role / Title
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Current Company / Organization
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    placeholder="e.g. Google, PPR Global"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  City / Location
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Basirhat, Kolkata"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  LinkedIn URL
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Bio / About You
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short summary about your background, interests, or what you're working on..."
                rows={3}
                className="w-full p-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] resize-none transition"
              />
            </div>

            {/* Academic & Institution Discovery */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    {instType === "SCHOOL" ? (
                      <School className="w-4 h-4 text-[#FF9933]" />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-[#FF9933]" />
                    )}
                    <span>{instType === "SCHOOL" ? "School Details" : "College / University Details"}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Institution affiliation helps alumni and classmates discover you.
                  </p>
                </div>

                {/* School vs College Selector */}
                <div className="flex rounded-xl bg-white/5 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setInstType("COLLEGE")}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      instType === "COLLEGE"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <GraduationCap className="w-3 h-3" />
                    <span>College</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstType("SCHOOL")}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      instType === "SCHOOL"
                        ? "bg-gradient-to-r from-[#FF9933] to-[#FF8008] text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <School className="w-3 h-3" />
                    <span>School</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {instType === "SCHOOL" ? "School Name *" : "College / University / Campus Name *"}
                </label>
                <div className="relative">
                  <School className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  {loadingSuggestions && (
                    <Loader2 className="w-3.5 h-3.5 text-[#FF9933] animate-spin absolute right-3 top-3" />
                  )}
                  <input
                    type="text"
                    value={institutionName}
                    onChange={(e) => {
                      setInstitutionName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={instType === "SCHOOL" ? "e.g. DPS, St. Xavier's School, Kendriya Vidyalaya" : "e.g. Kalyani Government Engineering College, Jadavpur University"}
                    className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] font-medium transition"
                    required
                  />
                </div>

                {/* Institution suggestions dropdown */}
                {showSuggestions && (instSuggestions.length > 0 || institutionName.trim().length >= 2) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0f1d] rounded-xl border border-white/10 shadow-2xl z-20 max-h-48 overflow-y-auto">
                    {instSuggestions.map((inst) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          setInstitutionName(inst.name);
                          setShowSuggestions(false);
                          if (inst.type === "SCHOOL") setInstType("SCHOOL");
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-white/10 transition flex items-center justify-between border-b border-white/5 last:border-0"
                      >
                        <span className="font-semibold text-white">{inst.name}</span>
                        {inst.city && (
                          <span className="text-[10px] text-slate-400 ml-2">{inst.city}</span>
                        )}
                      </button>
                    ))}
                    {institutionName.trim().length >= 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 transition flex items-center gap-1.5 font-semibold border-t border-amber-500/30"
                      >
                        <span>✓ Use &quot;{institutionName.trim()}&quot; as custom {instType === "SCHOOL" ? "school" : "institution"}</span>
                      </button>
                    )}
                  </div>
                )}

                {!loadingSuggestions && institutionName.trim().length >= 2 && instSuggestions.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>&quot;{institutionName.trim()}&quot; will be saved as your custom {instType === "SCHOOL" ? "school" : "institution"}.</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {instType === "SCHOOL" ? "Class / Stream" : "Department / Stream"}
                  </label>
                  <div className="relative">
                    <School className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={departmentName}
                      onChange={(e) => setDepartmentName(e.target.value)}
                      placeholder={instType === "SCHOOL" ? "e.g. 10th Standard, 12th Science" : "e.g. MCA, CSE, IT"}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {instType === "SCHOOL" ? "Board / Section" : "Course / Degree"}
                  </label>
                  <div className="relative">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder={instType === "SCHOOL" ? "e.g. CBSE, ICSE, State Board" : "e.g. B.Tech, BCA, MCA"}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {instType === "SCHOOL" ? "Passing Year / Class of" : "Graduation Year / Class"}
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      min={1950}
                      max={2040}
                      value={batchYear}
                      onChange={(e) => setBatchYear(e.target.value)}
                      placeholder="e.g. 2026"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF9933]/50 focus:bg-[#080811] font-medium transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-saffron px-5 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-[#ff9933]/25 disabled:opacity-50 active:scale-98"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
