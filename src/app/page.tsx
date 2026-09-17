import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  GraduationCap,
  Users,
  ShieldAlert,
  ShieldCheck,
  Briefcase,
  Sparkles,
  ArrowRight,
  MapPin,
  Building,
  UserCheck,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    // Unauthenticated Welcome Landing
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-50">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 mb-6">
            <GraduationCap className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Your Alumni Community
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Find batchmates, request senior mentorship, discover exclusive job referrals, and reunite with your alma mater.
          </p>

          <div className="my-8 grid grid-cols-2 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <Users className="w-5 h-5 text-blue-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Batch Directory</p>
              <p className="text-[11px] text-slate-500">Search by year, city & company</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <Sparkles className="w-5 h-5 text-indigo-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Senior Mentorship</p>
              <p className="text-[11px] text-slate-500">Resume review & mock talks</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <Briefcase className="w-5 h-5 text-emerald-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Jobs & Referrals</p>
              <p className="text-[11px] text-slate-500">Internal alumni referral leads</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-purple-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Passive Trust</p>
              <p className="text-[11px] text-slate-500">Batchmates vouch for batchmates</p>
            </div>
          </div>

          <Link
            href="/auth"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-[0.99]"
          >
            Get Started with Phone Number <ArrowRight className="w-4 h-4" />
          </Link>

          <p className="text-xs text-slate-400 mt-4">
            No passwords required • Instant phone OTP sign-in
          </p>
        </div>
      </main>
    );
  }

  // Authenticated Alumni Dashboard
  const isVerified = user.verificationStatus === "VERIFIED";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {user.institution.name}
              </h1>
              <p className="text-[11px] text-slate-500">
                Class of {user.batchYear} {user.department ? `• ${user.department.name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">{user.name}</p>
              <span
                className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isVerified ? "Verified Member" : "Unverified"}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Verification Status Banner (Phase 1 & 3 requirement) */}
        {!isVerified && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-4 sm:p-5 flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-amber-900">Your Account is Unverified</h2>
                <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  Action Required in Phase 3
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                To protect privacy and prevent spam, posting jobs or sending direct mentor requests requires verification.
                Any verified batchmate from your <strong>Class of {user.batchYear}</strong> can vouch for you with one tap.
              </p>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{user.name}</h2>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {user.verificationStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {user.currentRole ? `${user.currentRole}` : "Alumni Member"}
                  {user.currentCompany ? ` at ${user.currentCompany}` : ""}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                  {user.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {user.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3" /> Class of {user.batchYear}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase Modules Navigation Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Community Hub
            </h3>
            <span className="text-[11px] text-blue-600 font-medium">Phase 1 Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 transition shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Alumni Directory</h4>
                  <p className="text-[11px] text-slate-500">Coming in Phase 2</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Filter and discover batchmates from {user.institution.name} by company, city, and batch.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 transition shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Passive Verification</h4>
                  <p className="text-[11px] text-slate-500">Coming in Phase 3</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vouch for your Class of {user.batchYear} batchmates to give them verified access.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 transition shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Mentorship Network</h4>
                  <p className="text-[11px] text-slate-500">Coming in Phase 5</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Request guidance from seniors or mark yourself available to help juniors.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 transition shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Jobs & Referrals</h4>
                  <p className="text-[11px] text-slate-500">Coming in Phase 6</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Post hiring opportunities and ask alumni for internal employee referrals.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
