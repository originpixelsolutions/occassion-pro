export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/40 to-indigo-600/40 animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-2 text-center">
          <div className="h-7 w-44 rounded-lg bg-white/10 animate-pulse mx-auto" />
          <div className="h-4 w-64 rounded bg-white/5 animate-pulse mx-auto" />
        </div>

        {/* Form fields */}
        <div className="space-y-3 pt-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 border border-white/10 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
          <div className="h-12 rounded-xl bg-violet-600/30 animate-pulse" />
        </div>

        {/* Divider */}
        <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}
