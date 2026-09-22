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
  Music,
  PartyPopper,
  Lock,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import FeedSection from "@/components/FeedSection";
import ClientAuthRedirect from "@/components/ClientAuthRedirect";

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();

  const searchParams = props.searchParams ? await props.searchParams : {};
  const code = searchParams?.code;

  if (typeof code === "string" && code && !user) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  }

  if (!user) {
    // Unauthenticated Welcome Landing
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-50">
        <ClientAuthRedirect />
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100/80 mb-3">
            <Lock className="w-3 h-3 text-blue-600" />
            <span>Signal-Grade Privacy • Verified Alumni Network</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Your Campus Network, Built for Privacy
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Reunite with verified batchmates, request senior mentorship, discover internal job referrals, and communicate with end-to-end encryption.
          </p>

          <div className="my-7 grid grid-cols-2 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition">
              <Lock className="w-5 h-5 text-blue-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Private E2EE Chat</p>
              <p className="text-[11px] text-slate-500">Encrypted messaging, voice & video calls</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition">
              <Users className="w-5 h-5 text-indigo-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Verified Directory</p>
              <p className="text-[11px] text-slate-500">Find batchmates by year & department</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition">
              <Briefcase className="w-5 h-5 text-emerald-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Jobs & Referrals</p>
              <p className="text-[11px] text-slate-500">Exclusive alumni openings & referral leads</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition">
              <Sparkles className="w-5 h-5 text-purple-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">Senior Mentorship</p>
              <p className="text-[11px] text-slate-500">Career guidance, mock talks & peer vouches</p>
            </div>
          </div>

          <Link
            href="/auth"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-[0.99]"
          >
            Join Your Alumni Network <ArrowRight className="w-4 h-4" />
          </Link>

          <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1.5 flex-wrap">
            <span>Zero Passwords Required</span>
            <span>•</span>
            <span>Instant Private ID or Gmail Sign-In</span>
            <span>•</span>
            <span>100% Free</span>
          </p>
        </div>
      </main>
    );
  }

  // Authenticated Alumni Dashboard
  const isVerified = user.verificationStatus === "VERIFIED";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Unified Profile & Institution Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          {/* Institution & Action Controls Bar */}
          <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20 shrink-0">
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

            <div className="flex items-center gap-2">
              <Link
                href="/messages"
                className="h-9 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1.5 text-xs font-bold transition shadow-2xs border border-blue-100"
                title="Private E2EE Chat & Calls"
              >
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Messages</span>
              </Link>
              <LogoutButton />
            </div>
          </div>

          {/* User Profile Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">{user.name}</h2>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {isVerified ? "Verified Member" : user.verificationStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {user.currentRole ? `${user.currentRole}` : "Alumni Member"}
                  {user.currentCompany ? ` at ${user.currentCompany}` : ""}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 flex-wrap">
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

        {/* Verification Status Banner (Phase 1 & 3 requirement) */}
        {!isVerified && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-4 sm:p-5 flex items-start justify-between gap-3.5">
            <div className="flex items-start gap-3.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-amber-900">Your Account is Unverified</h2>
                  <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-xl">
                  To protect privacy and prevent spam, posting jobs or sending direct mentor requests requires verification.
                  Any verified batchmate from your <strong>Class of {user.batchYear}</strong> can vouch for you with one tap.
                </p>
              </div>
            </div>
            <Link
              href="/verification"
              className="shrink-0 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              Get Verified →
            </Link>
          </div>
        )}

        {/* Mobile App Native Quick Actions Bar */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Campus Hub
            </h3>
            <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
              Class of {user.batchYear}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
            <Link
              href="/messages"
              className="p-3 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <Lock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Private Chat</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Calls & E2EE</span>
            </Link>

            <Link
              href="/groups"
              className="p-3 rounded-2xl bg-white border border-pink-100 hover:border-pink-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <Music className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Groups</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Chat & Music</span>
            </Link>

            <Link
              href="/directory"
              className="p-3 rounded-2xl bg-white border border-blue-100 hover:border-blue-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Directory</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Batchmates</span>
            </Link>

            <Link
              href="/reunions"
              className="p-3 rounded-2xl bg-white border border-amber-100 hover:border-amber-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <PartyPopper className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Reunions</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Plan & Meet</span>
            </Link>

            <Link
              href="/jobs"
              className="p-3 rounded-2xl bg-white border border-purple-100 hover:border-purple-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Jobs</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Referrals</span>
            </Link>

            <Link
              href="/mentorship"
              className="p-3 rounded-2xl bg-white border border-indigo-100 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Mentors</span>
              <span className="text-[9px] text-slate-400 mt-0.5">1-on-1 Help</span>
            </Link>

            <Link
              href="/verification"
              className="p-3 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center group"
            >
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Vouch</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Trust Batch</span>
            </Link>
          </div>
        </div>

        {/* LinkedIn-Style Network Feed (Phase 4) */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Campus & Alumni Feed
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium">Phase 4 Active</span>
          </div>

          <FeedSection
            currentUserName={user.name}
            currentUserRole={user.currentRole}
            currentUserCompany={user.currentCompany}
            currentUserVerified={isVerified}
            batchYear={user.batchYear}
          />
        </div>
      </main>
    </div>
  );
}
