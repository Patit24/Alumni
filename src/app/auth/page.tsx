"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Loader2, Search, Phone, Mail,
  ArrowRight, ArrowLeft, CheckCircle2, Zap,
  Building2, X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getOrCreateDeviceIdentity } from "@/lib/e2ee/vault";
import { motion, AnimatePresence } from "framer-motion";

interface Institution {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  _count?: { users: number };
}

/* ───────── tiny sub-components ───────── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? "w-6 bg-blue-600"
              : i < current
              ? "w-3 bg-blue-300"
              : "w-3 bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const SLIDE = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};
const SPRING = { type: "spring" as const, stiffness: 400, damping: 35 };

export default function AuthPage() {
  const router = useRouter();

  /* ─── MODE: instant wizard vs phone/email login vs google-onboard ─── */
  const [mode, setMode] = useState<"wizard" | "phone" | "email" | "google-onboard">("wizard");
  const [wizardStep, setWizardStep] = useState(0); // 0=name 1=college 2=batch
  const [slideDir, setSlideDir] = useState(1);

  /* ─── WIZARD FIELDS ─── */
  const [wName, setWName] = useState("");
  const [wUsername, setWUsername] = useState("");
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  const [wInstId, setWInstId] = useState("");
  const [wInstName, setWInstName] = useState(""); // display name of selected inst
  const [wCustomInstName, setWCustomInstName] = useState("");
  const [wBatchYear, setWBatchYear] = useState(new Date().getFullYear().toString());
  const [wDept, setWDept] = useState("");

  /* ─── INSTITUTION SEARCH ─── */
  const [instQuery, setInstQuery] = useState("");
  const [instResults, setInstResults] = useState<Institution[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const instRef = useRef<HTMLDivElement>(null);

  /* ─── PHONE/EMAIL AUTH ─── */
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [googleAvatar, setGoogleAvatar] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [signupToken, setSignupToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  /* ─── SHARED ─── */
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + 2 - i);

  /* Handle OAuth callback params or check existing session */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const verifiedEmail = params.get("email") || params.get("verifiedEmail");
    const verifiedName = params.get("name");
    const token = params.get("signupToken");
    const avatar = params.get("avatar");

    // If redirected from Google OAuth with a signup token for a new user
    if ((modeParam === "google-onboard" || verifiedEmail) && token) {
      if (verifiedEmail) setEmailInput(verifiedEmail);
      if (verifiedName) {
        setWName(verifiedName);
        const clean = verifiedName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (clean) setWUsername(`${clean}_${Math.random().toString(36).substring(2, 5)}`);
      }
      setSignupToken(token);
      if (avatar) setGoogleAvatar(avatar);
      setMode("google-onboard");
      return;
    }

    // Check if user is already authenticated
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.authenticated) window.location.href = "/"; })
      .catch(() => {});
  }, []);

  /* OTP resend countdown */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  /* institution search */
  useEffect(() => {
    const q = instQuery.trim();
    if (!q) { setInstResults([]); return; }
    const t = setTimeout(async () => {
      setInstLoading(true);
      try {
        const res = await fetch(`/api/institutions?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setInstResults(data.institutions || []);
      } catch { setInstResults([]); }
      finally { setInstLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [instQuery]);

  /* auto-generate username from name */
  const handleNameChange = (val: string) => {
    setWName(val);
    if (!userEditedUsername) {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean) {
        const rand = Math.random().toString(36).substring(2, 5);
        setWUsername(`${clean}_${rand}`);
      } else setWUsername("");
    }
  };

  const go = (step: number) => {
    setSlideDir(step > wizardStep ? 1 : -1);
    setWizardStep(step);
    setError(null);
  };

  /* ─── STEP VALIDATION ─── */
  const canProceed0 = wName.trim().length >= 2;
  const canProceed1 =
    (wInstId !== "" && wInstName !== "") ||
    wInstName.trim().length >= 2 ||
    wCustomInstName.trim().length >= 2 ||
    instQuery.trim().length >= 2;
  const canSubmit = canProceed0 && canProceed1 && wBatchYear !== "";

  /* ─── WIZARD SUBMIT ─── */
  const handleWizardSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const localIdentity = await getOrCreateDeviceIdentity("temp_init");
      const chosenCollege = (wInstName || wCustomInstName || instQuery).trim();
      const res = await fetch("/api/auth/instant-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wName.trim(),
          username: wUsername.trim() || undefined,
          batchYear: parseInt(wBatchYear, 10),
          departmentName: wDept.trim() || undefined,
          institutionId: wInstId || undefined,
          institutionName: chosenCollege || undefined,
          customInstitutionName: chosenCollege || undefined,
          publicKey: localIdentity.publicKeySpki,
          deviceId: localIdentity.deviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Account creation failed");
      try { localStorage.setItem("alumni_user", JSON.stringify(data.user)); } catch {}
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "Failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ─── PHONE/EMAIL SUBMIT ─── */
  const handleSendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = mode === "phone"
        ? { phone: phoneInput.replace(/\D/g, "").slice(-10) }
        : { email: emailInput.trim().toLowerCase() };
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process request");
      if (data.loggedIn) { window.location.href = "/"; return; }
      if (data.signupToken) {
        setSignupToken(data.signupToken);
        if (mode === "email" || data.isNewUser) {
          // Seamless onboarding: email already verified, proceed directly to complete profile!
          if (!wName) setWName(emailInput.split("@")[0]);
          setMode("google-onboard");
          return;
        }
      }
      setOtp(data.testCode || "");
      setOtpStep(true);
      setResendCooldown(30);
    } catch (err: any) { setError(err?.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = mode === "phone"
        ? { phone: phoneInput.replace(/\D/g, "").slice(-10), code: otp.trim() }
        : { email: emailInput.trim().toLowerCase(), code: otp.trim() };
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      window.location.href = "/";
    } catch (err: any) { setError(err?.message); }
    finally { setLoading(false); }
  };

  /* ─── GOOGLE / EMAIL DIRECT ONBOARD SUBMIT ─── */
  const handleGoogleOnboardSubmit = async () => {
    const chosenCollege = (wInstName || wCustomInstName || instQuery).trim();
    if (!chosenCollege) {
      setError("Please search or enter your college name.");
      return;
    }
    if (!wBatchYear) {
      setError("Please select your graduation year.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken,
          email: emailInput.trim().toLowerCase(),
          name: wName.trim() || emailInput.split("@")[0] || "Alumni Member",
          institutionId: wInstId || undefined,
          institutionName: chosenCollege,
          newInstitutionName: chosenCollege,
          batchYear: parseInt(wBatchYear, 10),
          departmentName: wDept.trim() || undefined,
          avatarUrl: googleAvatar || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Account setup failed");
      try { localStorage.setItem("alumni_user", JSON.stringify(data.user)); } catch {}
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "Failed to complete registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err?.message || "Google Sign-In failed");
      setGoogleLoading(false);
    }
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-blue-600 text-white items-center justify-center shadow-2xl shadow-blue-500/30 mb-3">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Alumni Network</h1>
          <p className="text-sm text-blue-300 mt-1">End-to-end encrypted private network</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait" custom={slideDir}>
            {/* ═══ WIZARD MODE ═══ */}
            {mode === "wizard" && (
              <motion.div
                key={`wizard-${wizardStep}`}
                custom={slideDir}
                variants={SLIDE}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={SPRING}
                className="p-6"
              >
                <StepDots current={wizardStep} total={3} />

                {/* STEP 0 — Name & Username */}
                {wizardStep === 0 && (
                  <div className="space-y-4">
                    {/* Primary Hero: Google Sign-In */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading || loading}
                      className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-slate-800 font-semibold text-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 group"
                    >
                      {googleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      ) : (
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                      )}
                      <span className="text-slate-800 group-hover:text-blue-600">Continue with Google</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-auto">
                        1-Click
                      </span>
                    </button>

                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 border-t border-slate-200" />
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">or create without email</span>
                      <div className="flex-1 border-t border-slate-200" />
                    </div>

                    <div className="text-center mb-3">
                      <h2 className="text-base font-bold text-slate-900">Instant Alumni Profile</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Quick setup without phone or email</p>
                    </div>

                    <Field label="Your full name *">
                      <input
                        type="text"
                        value={wName}
                        onChange={e => handleNameChange(e.target.value)}
                        placeholder="e.g. Patitpaban Roy"
                        autoFocus
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                    </Field>

                    <Field label="@username" hint="Used for QR connect and search. Auto-generated but editable.">
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-slate-400 text-sm font-bold">@</span>
                        <input
                          type="text"
                          value={wUsername}
                          onChange={e => {
                            setUserEditedUsername(true);
                            setWUsername(e.target.value.replace(/^@/, "").replace(/[^a-z0-9_]/g, "").toLowerCase());
                          }}
                          placeholder="patit_x7q"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-4 text-sm font-mono text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                      </div>
                    </Field>

                    <button
                      type="button"
                      disabled={!canProceed0}
                      onClick={() => go(1)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-40 active:scale-[0.98]"
                    >
                      Next — Choose College <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* STEP 1 — College */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => go(0)} className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Your college</h2>
                        <p className="text-xs text-slate-500">Search and select your institution</p>
                      </div>
                    </div>

                    {/* Selected institution pill */}
                    {(wInstId || wInstName) && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-sm font-bold text-blue-900 flex-1 truncate">{wInstName || wCustomInstName || instQuery}</span>
                        <button
                          type="button"
                          onClick={() => { setWInstId(""); setWInstName(""); setWCustomInstName(""); setInstQuery(""); }}
                          className="h-5 w-5 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition"
                        >
                          <X className="w-3 h-3 text-blue-700" />
                        </button>
                      </div>
                    )}

                    {/* Search field */}
                    {!wInstId && !wInstName && (
                      <div ref={instRef} className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        {instLoading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3.5 top-3.5" />}
                        <input
                          type="text"
                          value={instQuery}
                          onChange={e => {
                            setInstQuery(e.target.value);
                            setWCustomInstName(e.target.value);
                          }}
                          placeholder="Search college, university, school..."
                          autoFocus
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                        {instResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-10 overflow-hidden max-h-52 overflow-y-auto">
                            {instResults.map(inst => (
                              <button
                                key={inst.id}
                                type="button"
                                onClick={() => {
                                  setWInstId(inst.id);
                                  setWInstName(inst.name);
                                  setInstQuery(inst.name);
                                  setInstResults([]);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-start gap-3 border-b border-slate-100 last:border-0"
                              >
                                <Building2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{inst.name}</p>
                                  <p className="text-[11px] text-slate-400">{inst.type}{inst.city ? ` · ${inst.city}` : ""}</p>
                                </div>
                              </button>
                            ))}
                            {/* Option to use typed name as custom */}
                            {instQuery.trim().length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWInstId("");
                                  setWCustomInstName(instQuery.trim());
                                  setInstResults([]);
                                  setWInstName(instQuery.trim());
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-amber-50 transition flex items-center gap-3 text-amber-700 bg-amber-50/50"
                              >
                                <Building2 className="w-4 h-4 shrink-0" />
                                <span className="text-sm font-semibold">Add "{instQuery.trim()}" as new institution</span>
                              </button>
                            )}
                          </div>
                        )}
                        {/* If typed but no results show and no selection */}
                        {!instLoading && instQuery.trim().length >= 2 && instResults.length === 0 && !wInstId && (
                          <p className="text-[11px] text-slate-400 mt-1.5 px-1">
                            No match found — your college name will be added as entered.
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!canProceed1}
                      onClick={() => go(2)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-40 active:scale-[0.98]"
                    >
                      Next — Batch Year <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* STEP 2 — Batch + Department */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => go(1)} className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Batch & department</h2>
                        <p className="text-xs text-slate-500">Almost done!</p>
                      </div>
                    </div>

                    {/* Summary chip */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate font-medium">{wInstName || wCustomInstName || instQuery}</span>
                    </div>

                    <Field label="Graduation year *">
                      <select
                        value={wBatchYear}
                        onChange={e => setWBatchYear(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      >
                        {years.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                        {/* allow going further back */}
                        {Array.from({ length: 30 }, (_, i) => currentYear - 3 - i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Department / Stream" hint="e.g. Computer Science, MCA, BBA — optional">
                      <input
                        type="text"
                        value={wDept}
                        onChange={e => setWDept(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                    </Field>

                    {error && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!canSubmit || loading}
                      onClick={handleWizardSubmit}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-40 active:scale-[0.98]"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your account…</>
                      ) : (
                        <><Zap className="w-4 h-4 text-amber-300 fill-amber-300" /> Create Account</>
                      )}
                    </button>
                  </div>
                )}

                {/* Error shown below step 0 and 1 */}
                {error && wizardStep < 2 && (
                  <p className="text-xs text-rose-600 mt-3 text-center font-medium">{error}</p>
                )}
              </motion.div>
            )}

            {/* ═══ GOOGLE / VERIFIED EMAIL ONBOARDING MODE ═══ */}
            {mode === "google-onboard" && (
              <motion.div
                key="google-onboard"
                custom={slideDir}
                variants={SLIDE}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={SPRING}
                className="p-6 space-y-4"
              >
                <div className="text-center mb-3">
                  {googleAvatar ? (
                    <img
                      src={googleAvatar}
                      alt={wName || "User"}
                      className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-blue-500 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                      {wName?.charAt(0)?.toUpperCase() || "A"}
                    </div>
                  )}
                  <h2 className="text-lg font-bold text-slate-900">
                    Welcome, {wName || "Alumni"}! 🎉
                  </h2>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[220px]">{emailInput || "Verified account"}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Almost there! Select your college and graduation year to complete your profile:
                  </p>
                </div>

                {/* College selection with autocomplete */}
                <Field label="College / University *">
                  {(wInstId || wInstName) ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm font-bold text-blue-900 flex-1 truncate">
                        {wInstName || wCustomInstName || instQuery}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setWInstId("");
                          setWInstName("");
                          setWCustomInstName("");
                          setInstQuery("");
                        }}
                        className="h-5 w-5 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition"
                      >
                        <X className="w-3 h-3 text-blue-700" />
                      </button>
                    </div>
                  ) : (
                    <div ref={instRef} className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      {instLoading && (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3.5 top-3.5" />
                      )}
                      <input
                        type="text"
                        value={instQuery}
                        onChange={e => {
                          setInstQuery(e.target.value);
                          setWCustomInstName(e.target.value);
                        }}
                        placeholder="Search college, university, school..."
                        autoFocus
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                      {instResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden max-h-52 overflow-y-auto">
                          {instResults.map(inst => (
                            <button
                              key={inst.id}
                              type="button"
                              onClick={() => {
                                setWInstId(inst.id);
                                setWInstName(inst.name);
                                setInstQuery(inst.name);
                                setInstResults([]);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-start gap-3 border-b border-slate-100 last:border-0"
                            >
                              <Building2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{inst.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {inst.type}
                                  {inst.city ? ` · ${inst.city}` : ""}
                                </p>
                              </div>
                            </button>
                          ))}
                          {instQuery.trim().length >= 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setWInstId("");
                                setWCustomInstName(instQuery.trim());
                                setInstResults([]);
                                setWInstName(instQuery.trim());
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-amber-50 transition flex items-center gap-3 text-amber-700 bg-amber-50/50"
                            >
                              <Building2 className="w-4 h-4 shrink-0" />
                              <span className="text-sm font-semibold">
                                Add "{instQuery.trim()}" as new institution
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                      {!instLoading &&
                        instQuery.trim().length >= 2 &&
                        instResults.length === 0 &&
                        !wInstId && (
                          <p className="text-[11px] text-slate-400 mt-1.5 px-1">
                            College will be saved as entered.
                          </p>
                        )}
                    </div>
                  )}
                </Field>

                {/* Graduation Year */}
                <Field label="Graduation year *">
                  <select
                    value={wBatchYear}
                    onChange={e => setWBatchYear(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                    {Array.from({ length: 30 }, (_, i) => currentYear - 3 - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </Field>

                {/* Department / Stream */}
                <Field label="Department / Stream" hint="e.g. Computer Science, BCA, B.Tech, MBA (optional)">
                  <input
                    type="text"
                    value={wDept}
                    onChange={e => setWDept(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </Field>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={loading || (!wInstId && !wInstName && !wCustomInstName && instQuery.trim().length < 2) || !wBatchYear}
                  onClick={handleGoogleOnboardSubmit}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-40 active:scale-[0.98]"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Completing registration…</>
                  ) : (
                    <><Zap className="w-4 h-4 text-amber-300 fill-amber-300" /> Complete Registration & Enter</>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("wizard");
                      setSignupToken("");
                      window.history.replaceState({}, document.title, window.location.pathname);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Cancel / Use another method
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══ PHONE LOGIN MODE ═══ */}
            {mode === "phone" && (
              <motion.div
                key="phone"
                custom={slideDir}
                variants={SLIDE}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={SPRING}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setMode("wizard"); setOtpStep(false); setError(null); }}
                    className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Phone sign in</h2>
                    <p className="text-xs text-slate-500">6-digit SMS code</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <span className="shrink-0 text-sm leading-none">⚠️</span>
                  <div>
                    <p className="font-semibold text-amber-900">SMS Gateway Offline</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Phone OTP delivery is temporarily disabled. Please use <strong>Google Sign-In</strong> or <strong>Instant Profile</strong> above.
                    </p>
                  </div>
                </div>

                {!otpStep ? (
                  <>
                    <Field label="Mobile number (India)">
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-sm font-bold text-slate-500">+91</span>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={e => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210"
                          autoFocus
                          maxLength={10}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-14 pr-4 text-sm font-mono text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                      </div>
                    </Field>
                    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
                    <button
                      disabled={loading || phoneInput.length !== 10}
                      onClick={handleSendOtp}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold shadow-md hover:bg-emerald-700 transition disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Code <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">Sent to +91 {phoneInput}</p>
                    <Field label="6-digit code">
                      <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        autoFocus
                        maxLength={6}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-2xl font-mono tracking-widest text-center text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                    </Field>
                    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
                    <button
                      disabled={loading || otp.length !== 6}
                      onClick={handleVerifyOtp}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold shadow-md hover:bg-emerald-700 transition disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Verify & Sign In</>}
                    </button>
                    {resendCooldown > 0 ? (
                      <p className="text-center text-xs text-slate-400">Resend in {resendCooldown}s</p>
                    ) : (
                      <button onClick={handleSendOtp} className="w-full text-center text-xs text-blue-600 hover:underline font-semibold">
                        Resend code
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ═══ EMAIL LOGIN MODE ═══ */}
            {mode === "email" && (
              <motion.div
                key="email"
                custom={slideDir}
                variants={SLIDE}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={SPRING}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setMode("wizard"); setOtpStep(false); setError(null); }}
                    className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Email sign in</h2>
                    <p className="text-xs text-slate-500">Continue with Google or email</p>
                  </div>
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/20 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-[0.98] disabled:opacity-50 group"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : (
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                  )}
                  <span className="text-slate-800 group-hover:text-blue-600">Continue with Google</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-auto">
                    Instant
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">or email</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                {!otpStep ? (
                  <>
                    <Field label="Email address">
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          value={emailInput}
                          onChange={e => setEmailInput(e.target.value)}
                          placeholder="you@example.com"
                          autoFocus
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                      </div>
                    </Field>
                    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
                    <button
                      disabled={loading || !emailInput.includes("@")}
                      onClick={handleSendOtp}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 transition disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">Code sent to {emailInput}</p>
                    <Field label="6-digit code">
                      <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        autoFocus
                        maxLength={6}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-2xl font-mono tracking-widest text-center text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                      />
                    </Field>
                    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
                    <button
                      disabled={loading || otp.length !== 6}
                      onClick={handleVerifyOtp}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 transition disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Sign In</>}
                    </button>
                  </>
                )}
                {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Bottom login switcher (only on wizard steps) ── */}
          {mode === "wizard" && (
            <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Already have an account?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSlideDir(1); setMode("phone"); setOtpStep(false); setError(null); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
                >
                  <Phone className="w-3.5 h-3.5" /> Phone
                </button>
                <button
                  onClick={() => { setSlideDir(1); setMode("email"); setOtpStep(false); setError(null); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-blue-400 mt-6">
          🔒 Encrypted · Private · No data sold
        </p>
      </div>
    </div>
  );
}
