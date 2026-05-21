'use client'

import { useState } from 'react'
import {
  Mail, Phone, MapPin, MessageSquare, Building2, Headphones,
  ArrowRight, CheckCircle2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTACT_OPTIONS = [
  {
    icon: Headphones,
    title: 'Sales',
    description: 'Talk to our sales team about pricing, custom plans, and enterprise contracts.',
    detail: 'sales@occasionpro.in',
    action: 'mailto:sales@occasionpro.in',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Support',
    description: 'Get help with your account, technical issues, or platform questions.',
    detail: 'support@occasionpro.in',
    action: 'mailto:support@occasionpro.in',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Building2,
    title: 'Partnerships',
    description: 'Integration partners, referral programmes, and agency reseller opportunities.',
    detail: 'partners@occasionpro.in',
    action: 'mailto:partners@occasionpro.in',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
]

const OFFICES = [
  {
    city: 'Mumbai',
    address: '14th Floor, One BKC, Bandra Kurla Complex, Mumbai 400051',
    phone: '+91 22 6900 0000',
    tag: 'HQ',
  },
  {
    city: 'Delhi',
    address: 'Level 12, Worldmark 1, Aerocity, New Delhi 110037',
    phone: '+91 11 4500 0000',
    tag: null,
  },
  {
    city: 'Bangalore',
    address: 'WeWork Galaxy, 43 Residency Road, Bangalore 560025',
    phone: '+91 80 6700 0000',
    tag: null,
  },
]

type FormState = {
  name: string
  email: string
  company: string
  phone: string
  subject: string
  message: string
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', company: '', phone: '', subject: 'general', message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="bg-[#09090b] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-16 lg:pt-32 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-gradient-to-b from-cyan-600/15 to-transparent blur-3xl" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Get in touch</h1>
        <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
          Whether you have a question, need a demo, or want to explore enterprise pricing —
          our team responds within 4 business hours.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/40">
          <Clock className="w-4 h-4" />
          <span>Average response time: 2 hours</span>
        </div>
      </section>

      {/* Contact options */}
      <section className="px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl grid gap-4 sm:grid-cols-3">
          {CONTACT_OPTIONS.map(({ icon: Icon, title, description, detail, action, color, bg }) => (
            <a
              key={title}
              href={action}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 hover:bg-white/8 transition-all group"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', bg)}>
                <Icon className={cn('w-5 h-5', color)} strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-white/55 mb-3 leading-relaxed">{description}</p>
              <span className={cn('text-sm font-medium', color)}>{detail}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Main contact form + offices */}
      <section className="px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-2">
          {/* Form */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>

            {submitted ? (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Message received!</h3>
                <p className="text-white/60">
                  We'll get back to you at <strong>{form.email}</strong> within 4 business hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Full Name *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      placeholder="Arun Kumar"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Work Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      placeholder="arun@eventco.in"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Company</label>
                    <input
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      placeholder="Event Company Pvt Ltd"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/50">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  >
                    <option value="general">General Enquiry</option>
                    <option value="demo">Request a Demo</option>
                    <option value="pricing">Pricing & Plans</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="support">Technical Support</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/50">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none"
                    placeholder="Tell us about your event company and what you're looking for…"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending…' : <><span>Send Message</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
          </div>

          {/* Offices */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Our offices</h2>
            <div className="space-y-4">
              {OFFICES.map(({ city, address, phone, tag }) => (
                <div key={city} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-white">{city}</h3>
                    {tag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                        {tag}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-white/55">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-white/30" strokeWidth={1.5} />
                      <span>{address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0 text-white/30" strokeWidth={1.5} />
                      <span>{phone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-900/20 to-indigo-900/10 p-5">
              <h3 className="font-semibold text-white mb-2">WhatsApp Support</h3>
              <p className="text-sm text-white/55 mb-3">
                Prefer WhatsApp? Message our support team directly. Available Mon–Sat, 9am–9pm IST.
              </p>
              <a
                href="https://wa.me/919XXXXXXXXX"
                className="inline-flex items-center gap-2 text-sm font-medium text-green-400 hover:text-green-300 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
