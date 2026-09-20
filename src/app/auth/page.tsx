"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  Sparkles,
  Search,
  ShieldCheck,
} from "lucide-react";

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
  // Multi-step state: "phone" | "otp" | "onboarding"
  const [step, setStep] = useState<"phone" | "otp" | "onboarding">("phone");

  // Form fields
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Onboarding fields
  const [name, setName] = useState("");
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
    if (step !== "onboarding" || !instSearchQuery.trim()) return;
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

  // Step 1: Send Production OTP via SMS
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch verification OTP");
      }

      setIsExistingUser(data?.isExistingUser || false);
      setOtp("");
      setStep("otp");
      setResendCooldown(30); // 30s resend timer
      setInfoMessage(`Verification code sent to +91 ${cleanPhone.slice(-10)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Production OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: trimmedOtp }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (!data.isNewUser) {
        // Returning user - session established
        router.push("/");
        router.refresh();
      } else {
        // New user - proceed to profile onboarding
        setSignupToken(data.signupToken);
        setStep("onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP code.");
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
          phone,
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

      // Success! Redirect to dashboard
      router.push("/");
      router.refresh();
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
              {step === "phone" && "Sign in or register your alumni account"}
              {step === "otp" && "SMS Verification"}
              {step === "onboarding" && "Complete your alumni profile"}
            </p>
          </div>
        </div>

        {/* Info or Error Alerts */}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* STEP 1: Phone Entry */}
        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Mobile Phone Number
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-semibold text-slate-500 select-none">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-14 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                We will send a 6-digit verification code to this mobile number.
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
                  Send Verification Code <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verification */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {isExistingUser ? "Welcome back • Enter OTP" : "Enter 6-digit SMS OTP"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change number
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
                <span>Didn&apos;t receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="text-slate-400 font-medium">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Verify & Continue <ArrowRight className="w-4 h-4" />
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
                Verified mobile: <strong>+91 {phone}</strong>
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
