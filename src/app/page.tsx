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
  CheckCircle2,
  QrCode,
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

  // Formatted city in Title Case
  const formattedCity = user.city
    ? user.city
        .trim()
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 sm:pb-12">
      {/* Global Floating Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Alma Mater Identity */}
          <Link href="/" className="flex items-center gap-3 group min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 tracking-tight truncate group-hover:text-blue-600 transition">
                  {user.institution.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Class of {user.batchYear} {user.department ? `• ${user.department.name}` : ""}
              </p>
            </div>
          </Link>

          {/* Action Header Nav */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/messages"
              className="h-9 px-3.5 sm:px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-xs font-bold transition shadow-xs shadow-blue-500/20 active:scale-95 shrink-0"
              title="End-to-End Encrypted Messages & Calls"
            >
              <div className="relative flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-blue-600 animate-pulse" />
              </div>
              <span className="tracking-tight">Messages</span>
            </Link>

            <Link
              href={`/profile/${user.id}`}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition shrink-0"
              title="My Profile"
            >
              <span className="hidden sm:inline">Profile</span>
            </Link>

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Alumni Identity Passport Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Ambient Header Cover Banner */}
          <div className="h-28 sm:h-36 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 relative p-4 flex items-end justify-between overflow-hidden">
            {/* Ambient Lighting Gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.3),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.2),transparent_50%)]" />

            {/* Banner Labels */}
            <div className="relative z-10 hidden sm:flex items-center gap-2 text-white/70 text-xs font-medium tracking-wide">
              <Building className="w-3.5 h-3.5 text-indigo-300" />
              <span>Verified Alumni Passport</span>
            </div>

            <div className="relative z-10 ml-auto flex items-center gap-2">
              <Link
                href="/settings/privacy/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-[11px] font-medium backdrop-blur-md border border-white/10 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Signal Privacy Active</span>
              </Link>
            </div>
          </div>

          {/* Profile Details Container (Overlapping the Banner) */}
          <div className="px-5 sm:px-8 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
              {/* Avatar with Floating Verified Check Badge */}
              <div className="relative">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl ring-4 ring-white bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-lg shadow-slate-900/15 shrink-0 select-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {isVerified && (
                  <div
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 text-white ring-2 ring-white flex items-center justify-center shadow-xs"
                    title="Verified Alumni Member"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Action Buttons on Card */}
              <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0">
                <Link
                  href={`/profile/${user.id}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition active:scale-98"
                >
                  <span>Edit Profile</span>
                </Link>
                <Link
                  href="/messages"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-98"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>My QR</span>
                </Link>
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
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user.institution.name}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Class of {user.batchYear} {user.department ? `(${user.department.name})` : ""}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Banner (if unverified) */}
        {!isVerified && (
          <div className="rounded-3xl bg-amber-50 border border-amber-200/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-amber-900">Your Account is Unverified</h2>
                  <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-xl">
                  To protect privacy and unlock direct referral posting and mentorship, any verified batchmate from your <strong>Class of {user.batchYear}</strong> can vouch for you with one tap.
                </p>
              </div>
            </div>
            <Link
              href="/verification"
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              Get Verified →
            </Link>
          </div>
        )}

        {/* Campus Hub: Interactive Feature Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Campus Hub
            </h2>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
              Class of {user.batchYear}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Private E2EE Chat */}
            <Link
              href="/messages"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Private Messages
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">E2EE Chat & Calls</p>
              </div>
            </Link>

            {/* Alumni Directory */}
            <Link
              href="/directory"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  Alumni Directory
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Search Batchmates</p>
              </div>
            </Link>

            {/* Jobs & Referrals */}
            <Link
              href="/jobs"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition">
                  Jobs & Referrals
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Internal Openings</p>
              </div>
            </Link>

            {/* Senior Mentorship */}
            <Link
              href="/mentorship"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-teal-600 transition">
                  Mentorship
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">1-on-1 Guidance</p>
              </div>
            </Link>

            {/* Campus Groups */}
            <Link
              href="/groups"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-pink-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-pink-600 transition">
                  Campus Groups
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Clubs & Chat</p>
              </div>
            </Link>

            {/* Reunions */}
            <Link
              href="/reunions"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <PartyPopper className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition">
                  Batch Reunions
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Plan & Meet</p>
              </div>
            </Link>

            {/* Peer Verification Vouch */}
            <Link
              href="/verification"
              className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Batch Vouching
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Verify Batchmates</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Campus & Alumni Feed */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Campus Activity Feed
              </h2>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>

          <FeedSection
            currentUserName={user.name}
            currentUserRole={user.currentRole}
            currentUserCompany={user.currentCompany}
            currentUserVerified={isVerified}
            batchYear={user.batchYear}
          />
        </section>
      </main>
    </div>
  );
}
