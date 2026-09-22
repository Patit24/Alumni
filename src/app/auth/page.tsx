"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  Sparkles,
  Search,
  MailCheck,
  Mail,
  Phone,
  Zap,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getOrCreateDeviceIdentity } from "@/lib/e2ee/vault";

interface Institution {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  departments: { id: string; name: string }[];
  _count?: { users: number };
}

export default function AuthPage() {
  const router = useRouter();
  // Multi-step state: "email" | "otp" | "onboarding"
  const [step, setStep] = useState<"email" | "otp" | "onboarding">("email");
  const [authMode, setAuthMode] = useState<"instant" | "phone" | "email">("instant");

  // Instant Private Identity fields
  const [instantName, setInstantName] = useState("");
  const [instantUsername, setInstantUsername] = useState("");
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  const [instantBatchYear, setInstantBatchYear] = useState(new Date().getFullYear().toString());
  const [instantDepartment, setInstantDepartment] = useState("");
  const [instantRole, setInstantRole] = useState("");
  const [instantCompany, setInstantCompany] = useState("");
  const [instantCity, setInstantCity] = useState("");

  // Form fields (Phone & Email OTP)
  const [phoneInput, setPhoneInput] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Onboarding fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedInstId, setSelectedInstId] = useState("");
  const [instSearchQuery, setInstSearchQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isCustomInst, setIsCustomInst] = useState(false);
  const [customInstName, setCustomInstName] = useState("");
  const [customInstType, setCustomInstType] = useState("COLLEGE");
  const [batchYear, setBatchYear] = useState(new Date().getFullYear().toString());
  const [departmentName, setDepartmentName] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [city, setCity] = useState("");

  // Loading, success & error states
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Fetch institutions for auto-complete
  useEffect(() => {
    if (!instSearchQuery.trim()) return;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/institutions?q=${encodeURIComponent(instSearchQuery)}`);
        const data = await res.json();
        if (data.institutions) {
          setInstitutions(data.institutions);
          const match = data.institutions.find(
            (i: Institution) => i.name.toLowerCase() === instSearchQuery.toLowerCase()
          );
          if (match) setSelectedInstId(match.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [instSearchQuery, step]);

  // Check if user is already authenticated or returning with OAuth params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifiedEmail = params.get("verifiedEmail");
    const prefillName = params.get("name");
    const querySignupToken = params.get("signupToken");

    if (verifiedEmail) {
      setEmail(verifiedEmail);
      if (prefillName) setName(prefillName);
      if (querySignupToken) setSignupToken(querySignupToken);
      setStep("onboarding");
    } else {
      // If already authenticated, redirect straight to dashboard
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated) {
            window.location.href = "/";
          }
        })
        .catch(() => {});
    }
  }, []);

  // Handle Display Name change & auto-suggest @username
  const handleNameChange = (val: string) => {
    setInstantName(val);
    if (!userEditedUsername) {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean) {
        const rand = Math.random().toString(36).substring(2, 6);
        setInstantUsername(`@${clean}_${rand}`);
      } else {
        setInstantUsername("");
      }
    }
  };

  // Instant Private Registration (No Phone, No OTP)
  const handleInstantRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedName = instantName.trim();
    if (!trimmedName) {
      setError("Please enter your display name");
      return;
    }

    setLoading(true);
    try {
      // 1. Generate NIST P-256 key pair locally on this client device
      const localIdentity = await getOrCreateDeviceIdentity("temp_init");

      // 2. Dispatch to instant identity API
      const res = await fetch("/api/auth/instant-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          username: instantUsername.replace(/^@/, "").trim() || undefined,
          batchYear: parseInt(instantBatchYear, 10) || new Date().getFullYear(),
          departmentName: instantDepartment.trim() || undefined,
          institutionId: isCustomInst ? undefined : selectedInstId || undefined,
          currentRole: instantRole.trim() || undefined,
          currentCompany: instantCompany.trim() || undefined,
          city: instantCity.trim() || undefined,
          publicKey: localIdentity.publicKeySpki,
          deviceId: localIdentity.deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create instant private account");
      }

      if (data.user) {
        try {
          localStorage.setItem("alumni_user", JSON.stringify(data.user));
        } catch {}
      }

      // Hard redirect to dashboard so server session cookie is recognized
      window.location.href = "/";
    } catch (err: any) {
      console.error("Instant register error:", err);
      setError(err?.message || "Failed to create instant account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // One-Click Google Sign-In via Supabase OAuth
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/api/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google Sign-In failed. Please try Email OTP.");
      setGoogleLoading(false);
    }
  };

  // Step 1: Send 6-digit OTP (Phone SMS or Gmail)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const isPhone = authMode === "phone";
    let payload: { email?: string; phone?: string } = {};

    if (isPhone) {
      const cleanPhone = phoneInput.replace(/[^0-9]/g, "");
      const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
      if (formatted10Digit.length !== 10) {
        setError("Please enter a valid 10-digit mobile number");
        return;
      }
      payload = { phone: formatted10Digit };
    } else {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        setError("Please enter a valid email address (e.g. you@gmail.com)");
        return;
      }
      payload = { email: cleanEmail };
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process request");
      }

      // 1. If returning user logged in directly without OTP
      if (data.loggedIn) {
        if (data.user) {
          try {
            localStorage.setItem("alumni_user", JSON.stringify(data.user));
          } catch {}
        }
        window.location.href = "/";
        return;
      }

      // 2. If new email user: proceed directly to onboarding without OTP
      if (data.isNewUser && !isPhone) {
        if (data.signupToken) {
          setSignupToken(data.signupToken);
        }
        setStep("onboarding");
        return;
      }

      // 3. For Phone SMS users: proceed to OTP verification
      setIsExistingUser(data?.isExistingUser || false);
      setOtp(data.testCode || "");
      setStep("otp");
      setResendCooldown(30); // 30s resend timer
      setInfoMessage(data.message || `We've sent a 6-digit code to your ${isPhone ? "phone via SMS" : "Gmail inbox"}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit Code
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    const isPhone = authMode === "phone";
    const payload = isPhone
      ? { phone: phoneInput.replace(/[^0-9]/g, "").slice(-10), code: trimmedOtp }
      : { email: email.trim().toLowerCase(), code: trimmedOtp };

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (!data.isNewUser) {
        // Returning user - session established, perform hard redirect to home
        window.location.href = "/";
      } else {
        // New user - proceed to profile onboarding
        setSignupToken(data.signupToken);
        if (isPhone && !phone) setPhone(phoneInput.replace(/[^0-9]/g, "").slice(-10));
        setStep("onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete Signup Onboarding
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your full name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          name: trimmedName,
          institutionId: isCustomInst ? null : selectedInstId || null,
          institutionName: isCustomInst ? customInstName : instSearchQuery,
          newInstitutionName: isCustomInst ? customInstName : null,
          newInstitutionType: isCustomInst ? customInstType : null,
          batchYear: parseInt(batchYear, 10) || new Date().getFullYear(),
          departmentName: departmentName.trim() || null,
          currentCompany: currentCompany.trim() || null,
          currentRole: currentRole.trim() || null,
          city: city.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
      }

      try {
        if (data.user) {
          localStorage.setItem("alumni_user", JSON.stringify(data.user));
        }
      } catch {}

      // Success! Hard reload to dashboard so Next.js server component reads the new session cookie
      window.location.href = "/";
    } catch (err: unknown) {
      console.error("Signup error details:", err);
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Generate batch year options (1970 to current year + 4)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 55 }, (_, i) => currentYear + 4 - i);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-bold shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Alumni Network</h1>
            <p className="text-xs text-slate-500">
              {step === "email" && "Sign in or register your alumni account"}
              {step === "otp" && "Check your Gmail inbox for code"}
              {step === "onboarding" && "Complete your alumni profile"}
            </p>
          </div>
        </div>

        {/* Info or Error Alerts */}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* STEP 1: Mode Switcher & Forms */}
        {step === "email" && (
          <div className="space-y-4">
            {/* Top Switcher: Instant Private Identity vs Phone SMS vs Email / Google */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("instant");
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  authMode === "instant"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span className="truncate">Instant ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("phone");
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  authMode === "phone"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Phone SMS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("email");
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  authMode === "email"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Email / Google</span>
              </button>
            </div>

            {/* OPTION A: Instant Private Identity (No Phone, No OTP) */}
            {authMode === "instant" && (
              <form onSubmit={handleInstantRegister} className="space-y-3">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant Private Account</span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 leading-relaxed">
                    Secure identity created locally on your device. No phone number or SMS verification required.
                  </p>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    value={instantName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Patitpaban Roy"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* Alumni Username (@handle) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alumni @Username *
                    </label>
                    <span className="text-[10px] text-blue-600 font-semibold">For search & QR connect</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={instantUsername}
                      onChange={(e) => {
                        setUserEditedUsername(true);
                        const val = e.target.value;
                        setInstantUsername(val.startsWith("@") ? val : `@${val}`);
                      }}
                      placeholder="@patit_7x92"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-sm font-mono font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Batch Year & Department */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Batch Year *
                    </label>
                    <select
                      value={instantBatchYear}
                      onChange={(e) => setInstantBatchYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={instantDepartment}
                      onChange={(e) => setInstantDepartment(e.target.value)}
                      placeholder="e.g. MCA / CSE"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Work info (Role & Company) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Current Role
                    </label>
                    <input
                      type="text"
                      value={instantRole}
                      onChange={(e) => setInstantRole(e.target.value)}
                      placeholder="e.g. Developer / Student"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Company / Org
                    </label>
                    <input
                      type="text"
                      value={instantCompany}
                      onChange={(e) => setInstantCompany(e.target.value)}
                      placeholder="e.g. Tech Corp"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Institution Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alma Mater / Institution
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomInst(!isCustomInst)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {isCustomInst ? "Default" : "+ Change"}
                    </button>
                  </div>

                  {isCustomInst ? (
                    <div className="space-y-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50/30">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={instSearchQuery}
                          onChange={(e) => setInstSearchQuery(e.target.value)}
                          placeholder="Search college or school..."
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none"
                        />
                      </div>
                      {institutions.length > 0 && (
                        <div className="max-h-24 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-1 bg-white">
                          {institutions.map((inst) => (
                            <button
                              type="button"
                              key={inst.id}
                              onClick={() => {
                                setSelectedInstId(inst.id);
                                setInstSearchQuery(inst.name);
                              }}
                              className={`w-full text-left p-1.5 rounded text-xs flex items-center justify-between ${
                                selectedInstId === inst.id ? "bg-blue-50 font-bold text-blue-800" : "hover:bg-slate-50"
                              }`}
                            >
                              <span className="truncate">{inst.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-medium text-slate-700">
                      <span className="truncate">{instSearchQuery || "Brainware University (Default)"}</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md shrink-0">
                        Selected
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !instantName.trim()}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating E2EE Keys & Launching...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>Generate Identity & Launch App</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* OPTION B: Phone SMS Sign-In */}
            {authMode === "phone" && (
              <div className="space-y-4">
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 text-left space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Mobile Number Verification</span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 leading-relaxed">
                      Enter your Indian mobile number. A 6-digit OTP will be dispatched directly to your SMS inbox.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Mobile Number (India)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-sm font-semibold text-slate-500 select-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        maxLength={10}
                        required
                        autoFocus
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-14 pr-4 text-sm font-mono font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Fast 6-digit carrier SMS delivered in seconds.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneInput.length !== 10}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.99]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Send 6-Digit SMS Code <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* OPTION C: Email / Google Sign-In */}
            {authMode === "email" && (
              <div className="space-y-4">
                {/* Google One-Click Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Or with Email
                  </span>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="patitpabanroy2002@gmail.com"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Fast sign in or registration — no OTP required.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Continue with Email <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: 6-Digit OTP Verification (SMS or Email) */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {isExistingUser
                    ? "Welcome back • Enter Code"
                    : authMode === "phone"
                    ? "Enter 6-digit SMS Code"
                    : "Enter 6-digit Code from Gmail"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {authMode === "phone" ? "Change phone" : "Change email"}
                </button>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                maxLength={6}
                autoFocus
                required
                className="w-full text-center tracking-widest text-xl font-bold rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 px-4 text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 font-mono"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{authMode === "phone" ? "Sent via SMS message" : "Check spam if not in inbox"}</span>
                {resendCooldown > 0 ? (
                  <span className="text-slate-400 font-medium">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-semibold text-white shadow-md transition disabled:opacity-50 active:scale-[0.99] ${
                authMode === "phone"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Verify & Enter <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Onboarding (New User Profile) */}
        {step === "onboarding" && (
          <form onSubmit={handleCompleteSignup} className="space-y-3.5">
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-800">
                Verified email: <strong>{email}</strong>
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Patitpaban Roy"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Optional Phone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9734019005"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Institution Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alma Mater / Institution *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomInst(!isCustomInst)}
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {isCustomInst ? "Choose from list" : "+ Add other"}
                </button>
              </div>

              {isCustomInst ? (
                <div className="space-y-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50/30">
                  <input
                    type="text"
                    value={customInstName}
                    onChange={(e) => setCustomInstName(e.target.value)}
                    placeholder="e.g. Brainware University"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-900 outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={customInstType}
                      onChange={(e) => setCustomInstType(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs font-medium text-slate-700 outline-none"
                    >
                      <option value="COLLEGE">College / University</option>
                      <option value="SCHOOL">High School</option>
                    </select>
                    <span className="text-[11px] text-slate-400 self-center">
                      (Founding member)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={instSearchQuery}
                      onChange={(e) => setInstSearchQuery(e.target.value)}
                      placeholder="Search college or school..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  {/* Dropdown list */}
                  <div className="max-h-28 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-1 bg-white">
                    {institutions.length === 0 ? (
                      <div className="p-2 text-center text-xs text-slate-400">
                        {searchLoading ? "Searching..." : "Type above or click '+ Add other'"}
                      </div>
                    ) : (
                      institutions.map((inst) => (
                        <button
                          type="button"
                          key={inst.id}
                          onClick={() => {
                            setSelectedInstId(inst.id);
                            setInstSearchQuery(inst.name);
                          }}
                          className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition ${
                            selectedInstId === inst.id || instSearchQuery.toLowerCase() === inst.name.toLowerCase()
                              ? "bg-blue-50 text-blue-900 font-semibold border border-blue-200"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="truncate">{inst.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                            {inst.type === "COLLEGE" ? "College" : "School"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Year & Department */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Batch Year *
                </label>
                <select
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="e.g. MCA"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Current Work & City */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  placeholder="e.g. PPR Global"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="e.g. Founder"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. BASIRHAT"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Complete Setup & Enter <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
