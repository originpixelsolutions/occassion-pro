import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OP</span>
            </div>
            <span className="text-white font-semibold text-lg">OccasionPro</span>
          </div>
        </div>

        {/* 404 */}
        <p className="text-8xl font-black text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text leading-none mb-6">
          404
        </p>

        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-white/50 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or may have been moved.
          Check the URL or head back to the dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
