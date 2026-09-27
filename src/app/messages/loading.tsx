export default function MessagesLoading() {
  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col p-4 pt-[max(1rem,calc(1rem+env(safe-area-inset-top,0px)))] max-w-lg mx-auto animate-pulse pb-24">
      {/* Messages Header */}
      <div className="flex items-center justify-between py-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20" />
          <div className="h-5 w-24 bg-white/10 rounded-md" />
        </div>
        <div className="h-8 w-24 rounded-full bg-white/10" />
      </div>

      {/* Search Input Skeleton */}
      <div className="h-11 w-full bg-white/5 rounded-2xl border border-white/5 mb-4" />

      {/* Tabs Skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-9 flex-1 bg-white/10 rounded-xl" />
        <div className="h-9 flex-1 bg-white/5 rounded-xl" />
        <div className="h-9 flex-1 bg-white/5 rounded-xl" />
      </div>

      {/* Conversation Items Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-10 bg-white/5 rounded" />
              </div>
              <div className="h-3 w-48 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
