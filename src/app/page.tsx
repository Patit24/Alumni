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
  Music,
  PartyPopper,
  Lock,
  CheckCircle2,
  QrCode,
  Compass,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import FeedSection from "@/components/FeedSection";
import ClientAuthRedirect from "@/components/ClientAuthRedirect";
import AlumniPassportCard from "@/components/AlumniPassportCard";
import InstitutionDiscoverySection from "@/components/InstitutionDiscoverySection";

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
            <span>Verified Alumni Network • End-to-End Encrypted</span>
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
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 text-xs font-semibold transition shrink-0"
              title="My Profile"
            >
              <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="hidden sm:inline font-medium">Profile</span>
            </Link>

            <LogoutButton showTextOnMobile={true} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Alumni Identity Passport Card */}
        <AlumniPassportCard user={user as any} />

        {/* People from User's College / University / School Discovery Section */}
        <InstitutionDiscoverySection
          institutionId={user.institutionId}
          initialInstitutionName={user.institution?.name}
        />

        {/* Quick 1-Click Feature Shortcuts Hub */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Campus Hub
            </h2>
            <Link
              href="/explore"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
            >
              <span>All Features</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Alumni Directory */}
            <Link
              href="/directory"
              className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition group flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                  Network
                </p>
                <p className="text-[11px] text-slate-500 truncate">Find Alumni</p>
              </div>
            </Link>

            {/* Jobs & Referrals */}
            <Link
              href="/jobs"
              className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-300 hover:shadow-xs transition group flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition truncate">
                  Jobs
                </p>
                <p className="text-[11px] text-slate-500 truncate">Referrals</p>
              </div>
            </Link>

            {/* Senior Mentorship */}
            <Link
              href="/mentorship"
              className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-300 hover:shadow-xs transition group flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 group-hover:text-teal-600 transition truncate">
                  Mentorship
                </p>
                <p className="text-[11px] text-slate-500 truncate">1-on-1 Help</p>
              </div>
            </Link>

            {/* Explore Hub */}
            <Link
              href="/explore"
              className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs hover:shadow-md transition group flex items-center gap-3 active:scale-95"
            >
              <div className="h-10 w-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white transition truncate">
                  Explore Hub
                </p>
                <p className="text-[11px] text-blue-100 truncate">More Features</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Campus & Alumni Feed */}
        <section className="pt-2">
          <FeedSection
            currentUserName={user.name}
            currentUserRole={user.currentRole}
            currentUserCompany={user.currentCompany}
            currentUserVerified={isVerified}
            batchYear={user.batchYear}
            currentUserAvatar={user.avatarUrl}
          />
        </section>
      </main>
    </div>
  );
}
