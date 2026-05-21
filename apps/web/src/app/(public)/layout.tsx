/**
 * Public layout — unauthenticated routes: /, /register, /login
 * Minimal: no sidebar, no auth guard.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
