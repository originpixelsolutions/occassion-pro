import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guest Portal — OccasionPro',
  description: 'Your personal event portal',
}

export default function GuestPortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
