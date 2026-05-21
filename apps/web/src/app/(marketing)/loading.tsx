export default function MarketingLoading() {
  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Nav skeleton */}
      <div className="h-16 border-b border-white/10 flex items-center px-6 gap-6">
        <div className="w-32 h-6 rounded-lg bg-white/10 animate-pulse" />
        <div className="ml-auto flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-16 h-4 rounded bg-white/5 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
          <div className="w-24 h-8 rounded-lg bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="px-6 pt-24 pb-16 flex flex-col items-center gap-5">
        <div className="h-6 w-40 rounded-full bg-white/10 animate-pulse" />
        <div className="h-12 w-2/3 max-w-xl rounded-xl bg-white/10 animate-pulse" />
        <div className="h-12 w-1/2 max-w-md rounded-xl bg-white/8 animate-pulse" />
        <div className="h-5 w-80 rounded bg-white/5 animate-pulse" />
        <div className="flex gap-3 mt-2">
          <div className="h-11 w-36 rounded-xl bg-violet-600/30 animate-pulse" />
          <div className="h-11 w-32 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
        </div>
      </div>

      {/* Content blocks */}
      <div className="px-6 pb-20 max-w-7xl mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-52 rounded-2xl border border-white/10 bg-white/3 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
