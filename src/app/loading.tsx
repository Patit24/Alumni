export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col p-4 max-w-lg mx-auto animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex items-center justify-between py-3 mb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/10" />
          <div className="h-4 w-28 bg-white/10 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-8 h-8 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Main Content Skeleton Blocks */}
      <div className="space-y-4">
        <div className="h-32 bg-white/5 rounded-3xl border border-white/5" />
        <div className="h-20 bg-white/5 rounded-2xl border border-white/5" />
        <div className="h-20 bg-white/5 rounded-2xl border border-white/5" />
        <div className="h-20 bg-white/5 rounded-2xl border border-white/5" />
      </div>
    </div>
  );
}
