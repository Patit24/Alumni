export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col p-4 pt-[max(1rem,calc(1rem+env(safe-area-inset-top,0px)))] max-w-2xl mx-auto animate-pulse pb-24">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between py-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20" />
          <div className="h-5 w-24 bg-white/10 rounded-md" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10" />
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-3 w-48 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
