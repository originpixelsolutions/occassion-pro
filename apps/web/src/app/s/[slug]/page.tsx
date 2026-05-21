import { notFound } from 'next/navigation'
import { Metadata } from 'next'

interface MicrositeData {
  id: string
  slug: string
  title: string
  description: string
  theme: string
  is_published: boolean
  cover_image_url?: string
  event?: {
    name: string
    start_date: string
    end_date: string
    venue?: { name: string; address: string }
  }
  ticket_types?: Array<{
    id: string
    name: string
    price: number
    quantity_available: number
    description?: string
  }>
}

async function getMicrosite(slug: string): Promise<MicrositeData | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/microsites/slug/${slug}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const site = await getMicrosite(params.slug)
  if (!site) return { title: 'Event Not Found' }
  return {
    title: site.title,
    description: site.description,
    openGraph: {
      title: site.title,
      description: site.description,
      images: site.cover_image_url ? [site.cover_image_url] : [],
    },
  }
}

export default async function MicrositePage({ params }: { params: { slug: string } }) {
  const site = await getMicrosite(params.slug)

  if (!site || !site.is_published) notFound()

  const event = site.event
  const tickets = site.ticket_types ?? []

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div
        className="relative h-72 sm:h-96 flex items-end overflow-hidden"
        style={{
          background: site.cover_image_url
            ? `url(${site.cover_image_url}) center/cover`
            : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="relative z-10 px-6 pb-8 max-w-3xl mx-auto w-full">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">{site.title}</h1>
          {event && (
            <p className="text-white/70 mt-1 text-sm">
              {new Date(event.start_date).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Description */}
        {site.description && (
          <section>
            <p className="text-gray-300 leading-relaxed">{site.description}</p>
          </section>
        )}

        {/* Event Details */}
        {event && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Event Details</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Date &amp; Time</p>
                <p className="text-white/80">
                  {new Date(event.start_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {event.venue && (
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Venue</p>
                  <p className="text-white/80">{event.venue.name}</p>
                  <p className="text-white/50 text-xs">{event.venue.address}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tickets */}
        {tickets.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Tickets</h2>
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{ticket.name}</p>
                    {ticket.description && (
                      <p className="text-sm text-white/50 mt-0.5">{ticket.description}</p>
                    )}
                    <p className="text-xs text-white/30 mt-1">
                      {ticket.quantity_available > 0
                        ? `${ticket.quantity_available} available`
                        : 'Sold out'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">
                        {ticket.price === 0
                          ? 'Free'
                          : `₹${ticket.price.toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <button
                      disabled={ticket.quantity_available === 0}
                      className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {ticket.quantity_available === 0 ? 'Sold Out' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-white/20">
            Powered by{' '}
            <a href="https://occasionpro.in" className="hover:text-white/40 transition-colors">
              OccasionPro
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
