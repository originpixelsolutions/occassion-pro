import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import InvitationViewer from '@/components/invitations/InvitationViewer'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

async function getInvitationData(shortCode: string) {
  try {
    const res = await fetch(`${API}/invitations/public/${shortCode}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function trackOpen(shortCode: string) {
  try {
    await fetch(`${API}/invitations/public/${shortCode}/open`, {
      method: 'POST',
      cache: 'no-store',
    })
  } catch {}
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortcode: string }>
}): Promise<Metadata> {
  const { shortcode } = await params
  const data = await getInvitationData(shortcode)

  if (!data) return { title: 'Invitation — OccasionPro' }

  const event = data.event
  return {
    title: `You're Invited: ${event.title}`,
    description: event.description ?? `You have been personally invited to ${event.title}`,
    openGraph: {
      title: `You're Invited: ${event.title}`,
      description: `A personalized invitation for you`,
      images: event.cover_image_url ? [{ url: event.cover_image_url }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `You're Invited: ${event.title}`,
    },
  }
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ shortcode: string }>
}) {
  const { shortcode } = await params
  const data = await getInvitationData(shortcode)

  if (!data) notFound()

  // Track open server-side (best effort, non-blocking)
  void trackOpen(shortcode)

  return (
    <InvitationViewer
      data={data}
      shortCode={shortcode}
      previewMode={false}
    />
  )
}
