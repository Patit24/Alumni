export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col p-4 max-w-2xl mx-auto animate-pulse pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between py-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="h-4 w-28 bg-white/10 rounded" />
        <div className="w-8 h-8 rounded-full bg-white/10" />
      </div>

      {/* Profile Card Hero */}
      <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-6 space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/10" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-40 bg-white/10 rounded" />
            <div className="h-4 w-24 bg-white/5 rounded" />
            <div className="h-4 w-32 bg-white/5 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 flex-1 bg-orange-500/20 rounded-xl" />
          <div className="h-9 w-12 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Profile Tabs & Details */}
      <div className="space-y-4">
        <div className="h-28 rounded-2xl bg-white/[0.02] border border-white/5" />
        <div className="h-28 rounded-2xl bg-white/[0.02] border border-white/5" />
      </div>
    </div>
  );
}
