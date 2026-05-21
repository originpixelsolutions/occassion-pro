export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4 gap-1">
        {/* Logo */}
        <div className="h-9 w-36 rounded-lg bg-muted animate-pulse mb-4" />
        {/* Nav items */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-9 w-full rounded-lg bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
        <div className="mt-auto">
          <div className="h-10 w-full rounded-lg bg-muted/40 animate-pulse" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-14 border-b border-border bg-card flex items-center px-6 gap-4">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="ml-auto flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>

        {/* Page content area */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page title */}
          <div className="h-8 w-56 rounded-lg bg-muted animate-pulse" />

          {/* Stat cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>

          {/* Content blocks */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 h-72 rounded-2xl border border-border bg-card animate-pulse" />
            <div className="h-72 rounded-2xl border border-border bg-card animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
