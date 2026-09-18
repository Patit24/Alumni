"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  Sparkles,
  Search,
  CheckCircle2,
  KeyRound,
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
  const [phone, setPhone] = useState("9868543657");
  const [otp, setOtp] = useState("123456");
  const [signupToken, setSignupToken] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [devCode, setDevCode] = useState<string>("123456");

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

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search institutions as user types
  useEffect(() => {
    if (step !== "onboarding") return;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/institutions?q=${encodeURIComponent(instSearchQuery)}`);
        const data = await res.json();
        if (data.institutions) {
          setInstitutions(data.institutions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [instSearchQuery, step]);

  // Step 1: Send OTP (Demo Mode)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!phone || phone.trim().length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      setIsExistingUser(data?.isExistingUser || false);
      setDevCode("123456");
      setOtp("123456");
      setStep("otp");
    } catch {
      // Fallback in case of network glitch
      setDevCode("123456");
      setOtp("123456");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    const codeToVerify = otp || "123456";

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: codeToVerify }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (!data.isNewUser) {
        // Returning user - session cookie is set!
        router.push("/");
        router.refresh();
      } else {
        // New user - proceed to profile onboarding
        setSignupToken(data.signupToken);
        setStep("onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete Signup Onboarding
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your full name");
      return;
    }

    if (!isCustomInst && !selectedInstId) {
      setError("Please select your institution or choose 'Add my institution'");
      return;
    }

    if (isCustomInst && !customInstName.trim()) {
      setError("Please enter your institution name");
      return;
    }

    if (!batchYear) {
      setError("Please select your batch graduation year");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken,
          name,
          institutionId: isCustomInst ? null : selectedInstId,
          newInstitutionName: isCustomInst ? customInstName : null,
          newInstitutionType: isCustomInst ? customInstType : null,
          batchYear: parseInt(batchYear, 10),
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

      // Success! Account created, cookie set, redirect to home
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-bold">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Alumni Network</h1>
            <p className="text-xs text-slate-500">
              {step === "phone" && "Sign in or create your alumni account"}
              {step === "otp" && "Verify your phone number"}
              {step === "onboarding" && "Complete your alumni profile"}
            </p>
          </div>
        </div>

        {/* Demo Mode Notice */}
        <div className="mb-5 p-3 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-start gap-2.5">
          <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <span className="font-bold">Demo OTP Mode:</span> Real SMS verification will be integrated later. Demo OTP is{" "}
            <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono font-bold text-blue-800">123456</code>.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium leading-relaxed">
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
                  placeholder="9868543657"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-14 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Enter any 10-digit number. Use Demo OTP <code className="font-semibold text-slate-600">123456</code> on next step.
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
                  Continue with Demo OTP <ArrowRight className="w-4 h-4" />
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
                  {isExistingUser ? "Welcome back • Enter OTP" : "Enter 6-digit Demo OTP"}
                </label>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change number
                </button>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                className="w-full text-center tracking-widest text-lg font-bold rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </div>

            {/* Demo bypass helper */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between">
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Demo OTP:</span>{" "}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">
                  {devCode}
                </code>
              </div>
              <button
                type="button"
                onClick={() => setOtp("123456")}
                className="text-[11px] font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition"
              >
                Auto-fill
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
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
          <form onSubmit={handleCompleteSignup} className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Welcome! Set up your alumni profile so your batchmates can identify and vouch for you.
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
                placeholder="e.g. Rahul Sharma"
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
                  {isCustomInst ? "Search existing list" : "+ Add new school/college"}
                </button>
              </div>

              {isCustomInst ? (
                <div className="space-y-2 p-3 rounded-xl border border-blue-200 bg-blue-50/30">
                  <input
                    type="text"
                    value={customInstName}
                    onChange={(e) => setCustomInstName(e.target.value)}
                    placeholder="e.g. Kalyani Government Engineering College"
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
                      (You will be founding member)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
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
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-1 bg-white">
                    {institutions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        {searchLoading ? "Searching..." : "No institutions found. Click '+ Add new school/college' above."}
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
                            selectedInstId === inst.id
                              ? "bg-blue-50 text-blue-900 font-semibold border border-blue-200"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="truncate">{inst.name}</span>
                          {selectedInstId === inst.id && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Batch & Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Batch Year *
                </label>
                <select
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
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
                  Department / Degree
                </label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="e.g. MCA, B.Tech CS"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Current Work & City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Current Company
                </label>
                <input
                  type="text"
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  placeholder="e.g. Google, TCS"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Current Role
                </label>
                <input
                  type="text"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Current City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Kolkata, Bengaluru, Pune"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99]"
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
