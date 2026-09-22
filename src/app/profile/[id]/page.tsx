import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ArrowLeft,
  GraduationCap,
  Building,
  Briefcase,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Phone,
  Eye,
  Lock,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const user = await db.user.findUnique({
    where: { id },
    include: {
      institution: true,
      department: true,
      batch: true,
    },
  });

  if (!user) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === user.id;
  const isVerified = user.verificationStatus === "VERIFIED";

  // Parse mentor topics if any
  const mentorTopicsList = user.mentorTopics
    ? user.mentorTopics.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 sm:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </Link>

          {isOwnProfile && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
              Your Profile
            </span>
          )}
        </div>
      </header>

      {/* Profile Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Main Profile Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Large Avatar */}
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-md shadow-blue-500/20 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{user.name}</h1>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    isVerified
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {isVerified ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Member
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Unverified
                    </>
                  )}
                </span>
              </div>

              {/* Current Role & Company */}
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {user.currentRole && user.currentCompany
                    ? `${user.currentRole} at ${user.currentCompany}`
                    : user.currentRole || user.currentCompany || "Alumni Member"}
                </span>
              </p>

              {/* Location & Alma Mater */}
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                {user.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {user.city}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {user.institution.name}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Class of {user.batchYear}
                </span>
              </div>
            </div>
          </div>

          {/* Social & Action Links */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">
            {user.linkedinUrl ? (
              <a
                href={user.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-xs font-semibold shadow-xs hover:bg-[#084e96] transition"
              >
                LinkedIn Profile <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-xs text-slate-400 italic">No LinkedIn profile provided</span>
            )}

            {/* Phone Display with privacy notice */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              {isOwnProfile || user.isPhoneVisible ? (
                <span>{user.phone}</span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Phone hidden by privacy
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Academic Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-blue-600" /> Education & Batch Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Institution</p>
              <p className="text-xs font-bold text-slate-800 mt-1">{user.institution.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{user.institution.city || "India"}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Graduation Batch</p>
              <p className="text-xs font-bold text-slate-800 mt-1">Class of {user.batchYear}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Alumni Network Member</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Department / Degree</p>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {user.department?.name || "General"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Faculty of Technology</p>
            </div>
          </div>
        </div>

        {/* Mentorship Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" /> Mentorship & Advice
            </h2>
            {user.isOpenToMentor ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Available to Mentor
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">
                Not actively mentoring
              </span>
            )}
          </div>

          {user.isOpenToMentor && mentorTopicsList.length > 0 ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-600">
                {user.name} is open to assisting juniors and batchmates with:
              </p>
              <div className="flex flex-wrap gap-2">
                {mentorTopicsList.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs font-medium px-3 py-1 rounded-xl bg-purple-50/80 text-purple-900 border border-purple-200/70"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              {!isOwnProfile && (
                <div className="pt-2">
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/50 text-white text-xs font-semibold cursor-not-allowed"
                    title="Mentorship request flow arrives in Phase 5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Request Mentorship (Available in Phase 5)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              This member hasn&apos;t set specific mentoring topics yet.
            </p>
          )}
        </div>

        {/* Privacy & Settings (Phase 2 Requirement) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" /> Privacy & Visibility Settings
            </h2>
            <span className="text-[10px] text-slate-400">
              {isOwnProfile ? "Manage your privacy" : "Public view"}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-800">Phone Number Visibility</p>
                <p className="text-[11px] text-slate-500">
                  {user.isPhoneVisible
                    ? "Visible to batchmates and verified members"
                    : "Hidden from public directory"}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  user.isPhoneVisible
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {user.isPhoneVisible ? "Public" : "Private"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-800">Cross-Institution Visibility</p>
                <p className="text-[11px] text-slate-500">
                  {user.mentorScope === "ALL"
                    ? "Profile discoverable by alumni across all colleges"
                    : `Scoped strictly to ${user.institution.name}`}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {user.mentorScope === "ALL" ? "All Colleges" : "My College Only"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
