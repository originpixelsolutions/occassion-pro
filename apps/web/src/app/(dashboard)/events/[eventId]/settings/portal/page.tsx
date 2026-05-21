'use client'

/**
 * Portal Settings — Staff Dashboard Page
 *
 * Allows staff to configure the guest-facing portal:
 *   - Enable/disable portal
 *   - OTP settings
 *   - Per-section toggles (drag-to-reorder)
 *   - Branding: title, color, cover image, welcome message
 *   - FAQ management
 *   - Announcement creation
 *   - Contact management
 *   - Preview link
 */

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Settings2, Eye, EyeOff, Palette, MessageSquare, List,
  ToggleLeft, ToggleRight, Loader2, CheckCircle2, Plus, Trash2,
  Users, Megaphone, HelpCircle, ExternalLink, Copy, Save,
  Phone, Mail,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalSettings {
  login_enabled: boolean
  allow_self_register: boolean
  otp_delivery: 'sms' | 'whatsapp' | 'both'
  portal_title: string
  hero_image_url: string
  brand_color: string
  welcome_message: string
  footer_text: string
  hide_powered_by: boolean
  not_on_list_message: string
  // Sections
  section_rsvp: boolean
  section_event_details: boolean
  section_accommodation: boolean
  section_transport: boolean
  section_meal: boolean
  section_gallery: boolean
  section_gift_registry: boolean
  section_sessions: boolean
  section_contact: boolean
  section_survey: boolean
  section_schedule: boolean
}

const SECTION_LABELS: Array<{ key: keyof PortalSettings; label: string; desc: string }> = [
  { key: 'section_rsvp', label: 'RSVP', desc: 'Guest can confirm or decline attendance' },
  { key: 'section_schedule', label: 'Itinerary / Schedule', desc: 'Event timeline and runsheet' },
  { key: 'section_event_details', label: 'Venue & Event Details', desc: 'Location, dress code, directions' },
  { key: 'section_accommodation', label: 'Stay & Hotels', desc: 'Accommodation options and booking info' },
  { key: 'section_transport', label: 'Transport', desc: 'Parking, shuttle, and transit info' },
  { key: 'section_meal', label: 'Food Menu', desc: 'Menu and dietary options' },
  { key: 'section_gallery', label: 'Gallery', desc: 'Event photos and media' },
  { key: 'section_gift_registry', label: 'Gift Registry', desc: 'Wishlist and gift suggestions' },
  { key: 'section_sessions', label: 'Updates & Announcements', desc: 'Real-time announcements from the team' },
  { key: 'section_contact', label: 'Contacts', desc: 'Key contacts and emergency numbers' },
  { key: 'section_survey', label: 'Survey', desc: 'Post-event or pre-event surveys' },
]

const DEFAULT_SETTINGS: PortalSettings = {
  login_enabled: true,
  allow_self_register: false,
  otp_delivery: 'whatsapp',
  portal_title: '',
  hero_image_url: '',
  brand_color: '#6366f1',
  welcome_message: '',
  footer_text: '',
  hide_powered_by: false,
  not_on_list_message: "We couldn't find your number on the guest list. Please contact the organiser.",
  section_rsvp: true,
  section_event_details: true,
  section_accommodation: true,
  section_transport: true,
  section_meal: true,
  section_gallery: true,
  section_gift_registry: false,
  section_sessions: true,
  section_contact: true,
  section_survey: false,
  section_schedule: true,
}

// ─── Sub-types ────────────────────────────────────────────────────────────────

interface Faq { id?: string; question: string; answer: string }
interface Announcement { id?: string; title: string; body: string; emoji: string; is_pinned: boolean }
interface Contact { id?: string; name: string; role: string; phone: string; email: string; whatsapp: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS)
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'sections' | 'branding' | 'content'>('general')

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token') ?? ''
    : ''
  const tenantId = typeof window !== 'undefined'
    ? localStorage.getItem('tenant_id') ?? ''
    : ''

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  }

  // Load settings
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/guest-portal/${eventId}/settings`, { headers })
        if (res.ok) {
          const data = await res.json()
          setSettings({ ...DEFAULT_SETTINGS, ...data })
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [eventId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/guest-portal/${eventId}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  const toggleSection = (key: keyof PortalSettings) => {
    setSettings(s => ({ ...s, [key]: !s[key] }))
  }

  const portalUrl = `${window?.location?.origin ?? ''}/${tenantId}/portal/${eventId}`

  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={20} /> Guest Portal Settings
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Manage what guests see when they visit their portal</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: '#1a1a1a', border: '1px solid #2e2e2e',
              color: '#aaa', textDecoration: 'none', fontSize: 13,
            }}
          >
            <Eye size={14} /> Preview <ExternalLink size={11} />
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: '#6366f1', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Portal Link */}
      <div style={{
        background: '#111',
        border: '1px solid #2e2e2e',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 24,
      }}>
        <span style={{ flex: 1, fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {portalUrl}
        </span>
        <button
          onClick={copyPortalLink}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#aaa', fontSize: 12, cursor: 'pointer' }}
        >
          <Copy size={12} /> Copy
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #2e2e2e', paddingBottom: 0 }}>
        {([
          { key: 'general', label: 'General' },
          { key: 'sections', label: 'Sections' },
          { key: 'branding', label: 'Branding' },
          { key: 'content', label: 'Content' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#f5f5f5' : '#666',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── General Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SettingToggle
            label="Portal Enabled"
            desc="Allow guests to access the portal via OTP login"
            value={settings.login_enabled}
            onChange={() => toggleSection('login_enabled')}
          />
          <SettingToggle
            label="Allow Self Registration"
            desc="Guests not on the list can register themselves"
            value={settings.allow_self_register}
            onChange={() => toggleSection('allow_self_register')}
          />

          <div>
            <label style={labelStyle}>OTP Delivery Channel</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['sms', 'whatsapp', 'both'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setSettings(s => ({ ...s, otp_delivery: ch }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                    border: settings.otp_delivery === ch ? '1.5px solid #6366f1' : '1.5px solid #2e2e2e',
                    background: settings.otp_delivery === ch ? 'rgba(99,102,241,0.1)' : '#1a1a1a',
                    color: settings.otp_delivery === ch ? '#6366f1' : '#888',
                    fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
                  }}
                >
                  {ch === 'both' ? 'SMS + WhatsApp' : ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Not On List Message</label>
            <textarea
              value={settings.not_on_list_message}
              onChange={e => setSettings(s => ({ ...s, not_on_list_message: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* ── Sections Tab ────────────────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#888' }}>
            Toggle which sections appear on the guest portal home screen.
          </p>
          {SECTION_LABELS.map(({ key, label, desc }) => (
            <SettingToggle
              key={key}
              label={label}
              desc={desc}
              value={!!settings[key]}
              onChange={() => toggleSection(key)}
            />
          ))}
        </div>
      )}

      {/* ── Branding Tab ────────────────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Portal Title</label>
            <input
              type="text"
              value={settings.portal_title}
              onChange={e => setSettings(s => ({ ...s, portal_title: e.target.value }))}
              placeholder="e.g. Sarah & Raj's Wedding"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Brand Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={settings.brand_color}
                onChange={e => setSettings(s => ({ ...s, brand_color: e.target.value }))}
                style={{ width: 48, height: 48, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'none' }}
              />
              <input
                type="text"
                value={settings.brand_color}
                onChange={e => setSettings(s => ({ ...s, brand_color: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="#6366f1"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Cover Image URL</label>
            <input
              type="url"
              value={settings.hero_image_url}
              onChange={e => setSettings(s => ({ ...s, hero_image_url: e.target.value }))}
              placeholder="https://..."
              style={inputStyle}
            />
            {settings.hero_image_url && (
              <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', height: 120 }}>
                <img src={settings.hero_image_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Welcome Message</label>
            <textarea
              value={settings.welcome_message}
              onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
              rows={3}
              placeholder="A warm message shown on the portal landing page..."
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Footer Text</label>
            <input
              type="text"
              value={settings.footer_text}
              onChange={e => setSettings(s => ({ ...s, footer_text: e.target.value }))}
              placeholder="© 2026 Your Company"
              style={inputStyle}
            />
          </div>

          <SettingToggle
            label="Hide 'Powered by OccasionPro'"
            desc="Remove the OccasionPro branding from the portal footer"
            value={settings.hide_powered_by}
            onChange={() => toggleSection('hide_powered_by')}
          />
        </div>
      )}

      {/* ── Content Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* FAQs */}
          <ContentSection
            title="FAQs"
            icon={<HelpCircle size={16} />}
            onAdd={() => setFaqs(f => [...f, { question: '', answer: '' }])}
          >
            {faqs.map((faq, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', background: '#111', borderRadius: 10, border: '1px solid #2e2e2e' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>FAQ {i + 1}</span>
                  <button onClick={() => setFaqs(f => f.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Question"
                  value={faq.question}
                  onChange={e => setFaqs(f => f.map((item, j) => j === i ? { ...item, question: e.target.value } : item))}
                  style={inputStyle}
                />
                <textarea
                  placeholder="Answer"
                  value={faq.answer}
                  onChange={e => setFaqs(f => f.map((item, j) => j === i ? { ...item, answer: e.target.value } : item))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                />
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API}/guest-portal/${eventId}/faqs`, {
                        method: 'POST', headers,
                        body: JSON.stringify({ question: faq.question, answer: faq.answer }),
                      })
                    } catch {}
                  }}
                  style={{ alignSelf: 'flex-end', padding: '6px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 12, cursor: 'pointer' }}
                >
                  Save FAQ
                </button>
              </div>
            ))}
            {faqs.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#555' }}>No FAQs yet. Add some common questions.</p>}
          </ContentSection>

          {/* Announcements */}
          <ContentSection
            title="Announcements"
            icon={<Megaphone size={16} />}
            onAdd={() => setAnnouncements(a => [...a, { title: '', body: '', emoji: '📣', is_pinned: false }])}
          >
            {announcements.map((ann, i) => (
              <div key={i} style={{ padding: '16px', background: '#111', borderRadius: 10, border: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Announcement {i + 1}</span>
                  <button onClick={() => setAnnouncements(a => a.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Emoji" value={ann.emoji}
                    onChange={e => setAnnouncements(a => a.map((item, j) => j === i ? { ...item, emoji: e.target.value } : item))}
                    style={{ ...inputStyle, width: 64, flexShrink: 0 }}
                  />
                  <input type="text" placeholder="Title" value={ann.title}
                    onChange={e => setAnnouncements(a => a.map((item, j) => j === i ? { ...item, title: e.target.value } : item))}
                    style={inputStyle}
                  />
                </div>
                <textarea placeholder="Message body" value={ann.body} rows={2}
                  onChange={e => setAnnouncements(a => a.map((item, j) => j === i ? { ...item, body: e.target.value } : item))}
                  style={{ ...inputStyle, resize: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer' }}>
                    <input type="checkbox" checked={ann.is_pinned}
                      onChange={e => setAnnouncements(a => a.map((item, j) => j === i ? { ...item, is_pinned: e.target.checked } : item))}
                    />
                    Pin to top
                  </label>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API}/guest-portal/${eventId}/announcements`, {
                          method: 'POST', headers,
                          body: JSON.stringify({ title: ann.title, body: ann.body, emoji: ann.emoji, is_pinned: ann.is_pinned }),
                        })
                      } catch {}
                    }}
                    style={{ padding: '6px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 12, cursor: 'pointer' }}
                  >
                    Publish
                  </button>
                </div>
              </div>
            ))}
            {announcements.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#555' }}>No announcements yet.</p>}
          </ContentSection>

          {/* Contacts */}
          <ContentSection
            title="Key Contacts"
            icon={<Users size={16} />}
            onAdd={() => setContacts(c => [...c, { name: '', role: '', phone: '', email: '', whatsapp: '' }])}
          >
            {contacts.map((c, i) => (
              <div key={i} style={{ padding: '16px', background: '#111', borderRadius: 10, border: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Contact {i + 1}</span>
                  <button onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Name" value={c.name}
                    onChange={e => setContacts(cs => cs.map((item, j) => j === i ? { ...item, name: e.target.value } : item))}
                    style={inputStyle}
                  />
                  <input type="text" placeholder="Role" value={c.role}
                    onChange={e => setContacts(cs => cs.map((item, j) => j === i ? { ...item, role: e.target.value } : item))}
                    style={inputStyle}
                  />
                </div>
                <input type="tel" placeholder="Phone" value={c.phone}
                  onChange={e => setContacts(cs => cs.map((item, j) => j === i ? { ...item, phone: e.target.value } : item))}
                  style={inputStyle}
                />
                <input type="email" placeholder="Email (optional)" value={c.email}
                  onChange={e => setContacts(cs => cs.map((item, j) => j === i ? { ...item, email: e.target.value } : item))}
                  style={inputStyle}
                />
                <button style={{ alignSelf: 'flex-end', padding: '6px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 12, cursor: 'pointer' }}>
                  Save Contact
                </button>
              </div>
            ))}
            {contacts.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#555' }}>No contacts added yet.</p>}
          </ContentSection>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#111', border: '1.5px solid #2e2e2e', borderRadius: 10,
  color: '#f5f5f5', fontSize: 14, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
}

function SettingToggle({
  label, desc, value, onChange,
}: {
  label: string; desc?: string; value: boolean; onChange: () => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: '#1a1a1a', border: '1px solid #2e2e2e',
        borderRadius: 12, cursor: 'pointer', gap: 16,
      }}
      onClick={onChange}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#f5f5f5' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {value
          ? <ToggleRight size={28} style={{ color: '#6366f1' }} />
          : <ToggleLeft size={28} style={{ color: '#555' }} />
        }
      </div>
    </div>
  )
}

function ContentSection({
  title, icon, onAdd, children,
}: {
  title: string; icon: React.ReactNode; onAdd: () => void; children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
          {icon} {title}
        </div>
        <button
          onClick={onAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#aaa', fontSize: 13, cursor: 'pointer' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}
