'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WebsiteSection {
  id: string
  section_type: string
  title: string
  content: Record<string, unknown>
  is_visible: boolean
  sort_order: number
}

interface EventWebsite {
  id: string
  slug: string
  title: string
  tagline?: string
  hero_image_url?: string
  favicon_url?: string
  theme_config: {
    primary_color?: string
    background_color?: string
    text_color?: string
    font_family?: string
    button_style?: 'rounded' | 'pill' | 'square'
  }
  custom_css?: string
  event_website_sections: WebsiteSection[]
  events?: {
    name: string
    start_date: string
    end_date?: string
    location?: string
    cover_image_url?: string
  }
  registration_enabled?: boolean
  registration_form_id?: string
  ticket_integration_enabled?: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function useCountdown(target: string) {
  const [diff, setDiff] = useState(new Date(target).getTime() - Date.now())
  useEffect(() => {
    const id = setInterval(() => setDiff(new Date(target).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  const total = Math.max(0, diff)
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    started: diff <= 0,
  }
}

// ─── Section Renderers ─────────────────────────────────────────────────────────

function HeroSection({
  section, website,
}: {
  section: WebsiteSection
  website: EventWebsite
}) {
  const c = section.content as {
    headline?: string
    subheadline?: string
    cta_text?: string
    cta_url?: string
    overlay_opacity?: number
    background_url?: string
  }
  const bg = c.background_url ?? website.hero_image_url ?? website.events?.cover_image_url
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  const opacity = c.overlay_opacity ?? 0.5

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: bg ? undefined : primary }}
    >
      {bg && (
        <img
          src={bg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,${opacity})` }}
      />
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight mb-4 drop-shadow-lg">
          {c.headline ?? website.title}
        </h1>
        {c.subheadline && (
          <p className="text-xl text-white/80 mb-8 leading-relaxed">{c.subheadline}</p>
        )}
        {website.events && (
          <div className="flex flex-wrap items-center justify-center gap-4 text-white/70 text-sm mb-8">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {fmtDate(website.events.start_date)}
              {website.events.end_date && website.events.end_date !== website.events.start_date && (
                <> – {fmtDate(website.events.end_date)}</>
              )}
            </span>
            {website.events.location && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {website.events.location}
              </span>
            )}
          </div>
        )}
        {c.cta_text && (
          <a
            href={c.cta_url ?? '#register'}
            className="inline-block px-8 py-3 font-semibold text-white rounded-full text-base shadow-lg transition-all hover:scale-105"
            style={{ background: primary }}
          >
            {c.cta_text}
          </a>
        )}
      </div>
    </section>
  )
}

function CountdownSection({
  section, website,
}: {
  section: WebsiteSection
  website: EventWebsite
}) {
  const c = section.content as {
    message_before?: string
    message_after?: string
    show_seconds?: boolean
    target_date?: string
  }
  const targetDate = c.target_date ?? website.events?.start_date ?? ''
  const { days, hours, minutes, seconds, started } = useCountdown(targetDate)
  const primary = website.theme_config.primary_color ?? '#7c3aed'

  const units = [
    { label: 'Days', value: days },
    { label: 'Hours', value: hours },
    { label: 'Minutes', value: minutes },
    ...(c.show_seconds !== false ? [{ label: 'Seconds', value: seconds }] : []),
  ]

  return (
    <section className="py-20 px-6 bg-zinc-950 text-center">
      <h2 className="text-2xl font-bold text-white mb-2">{section.title}</h2>
      <p className="text-zinc-400 mb-10 text-sm">
        {started ? (c.message_after ?? 'Event has started!') : (c.message_before ?? 'Event starts in')}
      </p>
      {!started && (
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {units.map(u => (
            <div key={u.label} className="text-center">
              <div
                className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-2xl sm:text-4xl font-bold text-white tabular-nums"
                style={{ background: `${primary}20`, border: `1px solid ${primary}40` }}
              >
                {String(u.value).padStart(2, '0')}
              </div>
              <p className="text-zinc-500 text-xs mt-2 uppercase tracking-wider">{u.label}</p>
            </div>
          ))}
        </div>
      )}
      {started && (
        <p className="text-2xl font-bold" style={{ color: primary }}>
          {c.message_after ?? 'The event has begun!'}
        </p>
      )}
    </section>
  )
}

function AboutSection({ section }: { section: WebsiteSection }) {
  const c = section.content as { body?: string; image_url?: string }
  return (
    <section className="py-20 px-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white text-center mb-10">{section.title}</h2>
      <div className={`flex flex-col ${c.image_url ? 'md:flex-row gap-10 items-center' : 'items-center'}`}>
        {c.image_url && (
          <img src={c.image_url} alt="" className="w-full md:w-1/2 rounded-2xl object-cover aspect-video" />
        )}
        <div className="prose prose-invert max-w-2xl text-zinc-300 leading-relaxed whitespace-pre-line text-base">
          {c.body}
        </div>
      </div>
    </section>
  )
}

function ScheduleSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  const c = section.content as {
    days?: Array<{
      date: string
      sessions: Array<{
        time: string
        title: string
        speaker?: string
        location?: string
        type?: string
      }>
    }>
  }
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  const [activeDay, setActiveDay] = useState(0)

  if (!c.days?.length) return null
  const day = c.days[activeDay]

  return (
    <section className="py-20 px-6 bg-zinc-900/30">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-10">{section.title}</h2>
        {c.days.length > 1 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {c.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={activeDay === i
                  ? { background: primary, color: '#fff' }
                  : { background: '#27272a', color: '#a1a1aa' }}
              >
                {d.date ? fmtDate(d.date) : `Day ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {(day?.sessions ?? []).map((s, i) => (
            <div key={i} className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <div className="flex-shrink-0 w-16 text-right">
                <p className="text-xs font-mono" style={{ color: primary }}>{s.time}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium">{s.title}</p>
                {s.speaker && <p className="text-zinc-400 text-xs mt-0.5">{s.speaker}</p>}
                {s.location && (
                  <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {s.location}
                  </p>
                )}
              </div>
              {s.type && (
                <span className="flex-shrink-0 self-start text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {s.type}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SpeakersSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  const c = section.content as {
    items?: Array<{
      name: string
      designation?: string
      company?: string
      bio?: string
      photo_url?: string
      linkedin_url?: string
    }>
  }
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  if (!c.items?.length) return null

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">{section.title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {c.items.map((sp, i) => (
            <div key={i} className="text-center group">
              <div className="relative w-20 h-20 mx-auto mb-3">
                {sp.photo_url ? (
                  <img src={sp.photo_url} alt={sp.name} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: `${primary}25`, border: `2px solid ${primary}40` }}
                  >
                    {sp.name.charAt(0)}
                  </div>
                )}
              </div>
              <p className="text-white text-sm font-medium">{sp.name}</p>
              {sp.designation && <p className="text-zinc-400 text-xs mt-0.5">{sp.designation}</p>}
              {sp.company && <p className="text-zinc-500 text-xs">{sp.company}</p>}
              {sp.linkedin_url && (
                <a
                  href={sp.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SponsorsSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  const c = section.content as {
    tiers?: Array<{
      name: string
      items: Array<{ name: string; logo_url?: string; website_url?: string }>
    }>
  }
  if (!c.tiers?.length) return null

  return (
    <section className="py-20 px-6 bg-zinc-900/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">{section.title}</h2>
        {c.tiers.filter(t => t.items?.length).map((tier, ti) => (
          <div key={ti} className="mb-10 last:mb-0">
            <p className="text-center text-zinc-400 text-xs uppercase tracking-widest mb-6">{tier.name}</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {tier.items.map((sp, si) => (
                <div key={si}>
                  {sp.website_url ? (
                    <a href={sp.website_url} target="_blank" rel="noopener noreferrer">
                      {sp.logo_url ? (
                        <img src={sp.logo_url} alt={sp.name} className="h-12 object-contain grayscale hover:grayscale-0 transition-all" />
                      ) : (
                        <span className="text-zinc-300 hover:text-white text-sm transition-colors">{sp.name}</span>
                      )}
                    </a>
                  ) : (
                    sp.logo_url
                      ? <img src={sp.logo_url} alt={sp.name} className="h-12 object-contain grayscale" />
                      : <span className="text-zinc-400 text-sm">{sp.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FaqSection({ section }: { section: WebsiteSection }) {
  const c = section.content as {
    items?: Array<{ question: string; answer: string }>
  }
  if (!c.items?.length) return null

  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-10">{section.title}</h2>
        <div className="space-y-2">
          {c.items.map((faq, i) => (
            <details
              key={i}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
                <span className="text-white text-sm font-medium">{faq.question}</span>
                <svg
                  className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-3 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-4 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800">
                <div className="pt-3">{faq.answer}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function RegisterSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  const c = section.content as {
    description?: string
    ticket_types?: Array<{
      name: string
      price: number
      currency?: string
      description?: string
      available?: boolean
    }>
    cta_text?: string
    cta_url?: string
  }
  const primary = website.theme_config.primary_color ?? '#7c3aed'

  return (
    <section id="register" className="py-20 px-6 bg-zinc-900/30">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{section.title}</h2>
        {c.description && <p className="text-zinc-400 mb-8 leading-relaxed">{c.description}</p>}
        {c.ticket_types?.length ? (
          <div className="grid gap-4 mb-8">
            {c.ticket_types.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-left">
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  {t.description && <p className="text-zinc-500 text-xs mt-0.5">{t.description}</p>}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-white font-semibold text-sm">
                    {t.price === 0 ? 'Free' : `${t.currency ?? '₹'}${t.price.toLocaleString('en-IN')}`}
                  </p>
                  {t.available === false && (
                    <p className="text-red-400 text-xs">Sold out</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <a
          href={c.cta_url ?? '#'}
          className="inline-block px-8 py-3 font-semibold text-white rounded-full text-base shadow-lg transition-all hover:scale-105"
          style={{ background: primary }}
        >
          {c.cta_text ?? 'Register Now'}
        </a>
      </div>
    </section>
  )
}

function MapSection({ section }: { section: WebsiteSection }) {
  const c = section.content as {
    address?: string
    embed_url?: string
    lat?: number
    lng?: number
    description?: string
  }

  const googleMapsUrl = c.lat && c.lng
    ? `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=15&output=embed`
    : c.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(c.address)}&z=15&output=embed`
    : c.embed_url

  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-4">{section.title}</h2>
        {c.address && <p className="text-zinc-400 text-sm text-center mb-6">{c.address}</p>}
        {c.description && <p className="text-zinc-500 text-xs text-center mb-6">{c.description}</p>}
        {googleMapsUrl && (
          <div className="rounded-2xl overflow-hidden border border-zinc-800">
            <iframe
              src={googleMapsUrl}
              width="100%"
              height="350"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Venue location"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function GallerySection({ section }: { section: WebsiteSection }) {
  const c = section.content as {
    images?: Array<{ url: string; caption?: string }>
    album_url?: string
  }
  if (!c.images?.length && !c.album_url) return null

  return (
    <section className="py-20 px-6 bg-zinc-900/30">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-10">{section.title}</h2>
        {c.images?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {c.images.map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-xl bg-zinc-800">
                <img
                  src={img.url}
                  alt={img.caption ?? ''}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : null}
        {c.album_url && (
          <div className="text-center mt-6">
            <a
              href={c.album_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              View Full Album
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function ContactSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  const c = section.content as {
    description?: string
    email?: string
    phone?: string
    form_enabled?: boolean
  }
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  return (
    <section className="py-20 px-6">
      <div className="max-w-xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-4">{section.title}</h2>
        {c.description && <p className="text-zinc-400 text-center mb-8">{c.description}</p>}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-zinc-300 hover:text-white text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {c.email}
            </a>
          )}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-zinc-300 hover:text-white text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {c.phone}
            </a>
          )}
        </div>
        {c.form_enabled !== false && !sent && (
          <form
            onSubmit={e => { e.preventDefault(); setSent(true) }}
            className="space-y-4"
          >
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Your message"
              rows={4}
              required
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            />
            <button
              type="submit"
              className="w-full py-3 text-white font-medium rounded-xl transition-all hover:opacity-90"
              style={{ background: primary }}
            >
              Send Message
            </button>
          </form>
        )}
        {sent && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium">Message sent!</p>
            <p className="text-zinc-500 text-xs mt-1">We'll get back to you soon.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function TextSection({ section }: { section: WebsiteSection }) {
  const c = section.content as { body?: string; align?: 'left' | 'center' | 'right' }
  return (
    <section className="py-16 px-6">
      <div className={`max-w-3xl mx-auto ${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : ''}`}>
        {section.title && <h2 className="text-2xl font-bold text-white mb-6">{section.title}</h2>}
        <div className="text-zinc-300 leading-relaxed whitespace-pre-line">{c.body}</div>
      </div>
    </section>
  )
}

function DividerSection({ website }: { website: EventWebsite }) {
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  return (
    <div className="py-4 px-6 flex items-center justify-center gap-4">
      <div className="flex-1 h-px bg-zinc-800" />
      <div className="w-2 h-2 rounded-full" style={{ background: primary }} />
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  )
}

// ─── Section Router ─────────────────────────────────────────────────────────────

function RenderSection({ section, website }: { section: WebsiteSection; website: EventWebsite }) {
  if (!section.is_visible) return null
  switch (section.section_type) {
    case 'hero':      return <HeroSection section={section} website={website} />
    case 'countdown': return <CountdownSection section={section} website={website} />
    case 'about':     return <AboutSection section={section} />
    case 'schedule':  return <ScheduleSection section={section} website={website} />
    case 'speakers':  return <SpeakersSection section={section} website={website} />
    case 'sponsors':  return <SponsorsSection section={section} website={website} />
    case 'faq':       return <FaqSection section={section} />
    case 'register':  return <RegisterSection section={section} website={website} />
    case 'map':       return <MapSection section={section} />
    case 'gallery':   return <GallerySection section={section} />
    case 'contact':   return <ContactSection section={section} website={website} />
    case 'text':      return <TextSection section={section} />
    case 'divider':   return <DividerSection website={website} />
    default:          return null
  }
}

// ─── Nav ───────────────────────────────────────────────────────────────────────

function SiteNav({ website }: { website: EventWebsite }) {
  const primary = website.theme_config.primary_color ?? '#7c3aed'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const navSections = website.event_website_sections.filter(
    s => s.is_visible && ['schedule', 'speakers', 'sponsors', 'faq', 'register', 'contact', 'gallery', 'map'].includes(s.section_type)
  ).slice(0, 5)

  if (!navSections.length) return null

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/50 shadow-xl' : 'bg-transparent'
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="text-white font-semibold text-sm truncate max-w-[200px]">
          {website.title}
        </a>
        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {navSections.map(s => (
            <a
              key={s.id}
              href={`#${s.section_type}`}
              className="text-zinc-400 hover:text-white text-sm transition-colors capitalize"
            >
              {s.title}
            </a>
          ))}
          {website.registration_enabled && (
            <a
              href="#register"
              className="px-4 py-1.5 text-white text-sm font-medium rounded-full transition-all hover:opacity-90"
              style={{ background: primary }}
            >
              Register
            </a>
          )}
        </div>
        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-zinc-400 hover:text-white"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>
      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden bg-zinc-950 border-b border-zinc-800 px-6 py-4 space-y-3">
          {navSections.map(s => (
            <a
              key={s.id}
              href={`#${s.section_type}`}
              onClick={() => setOpen(false)}
              className="block text-zinc-300 hover:text-white text-sm capitalize py-1"
            >
              {s.title}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventWebsitePage() {
  const { slug } = useParams<{ slug: string }>()
  const [website, setWebsite] = useState<EventWebsite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/v1/sites/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.statusCode >= 400) {
          setError(data.message ?? 'Website not found')
        } else {
          setWebsite(data)
        }
      })
      .catch(() => setError('Failed to load event website'))
      .finally(() => setLoading(false))
  }, [slug])

  // Inject custom CSS and dynamic meta
  useEffect(() => {
    if (!website) return
    // Title
    document.title = website.title
    // Favicon
    if (website.favicon_url) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link')
      link.rel = 'icon'
      link.href = website.favicon_url
      document.head.appendChild(link)
    }
    // Custom CSS
    if (website.custom_css) {
      const style = document.createElement('style')
      style.textContent = website.custom_css
      document.head.appendChild(style)
    }
  }, [website])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !website) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-center px-6">
        <div>
          <p className="text-zinc-600 text-6xl mb-6">404</p>
          <h1 className="text-white text-xl font-semibold mb-2">Event website not found</h1>
          <p className="text-zinc-500 text-sm">
            {error ?? 'This event website may not be published yet or the link may be incorrect.'}
          </p>
        </div>
      </div>
    )
  }

  const primaryColor = website.theme_config.primary_color ?? '#7c3aed'

  return (
    <div
      className="min-h-screen"
      style={{
        background: website.theme_config.background_color ?? '#09090b',
        color: website.theme_config.text_color ?? '#ffffff',
        fontFamily: website.theme_config.font_family ?? 'inherit',
      }}
    >
      <SiteNav website={website} />

      <main>
        {website.event_website_sections
          .filter(s => s.is_visible)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(section => (
            <div key={section.id} id={section.section_type}>
              <RenderSection section={section} website={website} />
            </div>
          ))}
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800 text-center">
        <p className="text-zinc-600 text-xs">
          Powered by{' '}
          <a
            href="https://occasionpro.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
            style={{ color: primaryColor }}
          >
            OccasionPro
          </a>
        </p>
      </footer>
    </div>
  )
}
