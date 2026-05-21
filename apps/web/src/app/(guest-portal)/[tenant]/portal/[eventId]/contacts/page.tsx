'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { guestApi } from '@/lib/guest-portal-api'
import { ArrowLeft, Users, Phone, Mail, MessageCircle, Loader2 } from 'lucide-react'

interface Contact {
  id: string
  name: string
  role?: string
  phone?: string
  email?: string
  whatsapp?: string
  avatar_url?: string
}

export default function ContactsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    guestApi.get<Contact[]>(`/guest-portal/${eventId}/sections/contacts`, eventId)
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [eventId])

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 32 }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} style={{ color: 'var(--portal-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Contacts</h1>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--portal-brand)' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
            <Users size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Contact list coming soon</p>
          </div>
        ) : (
          contacts.map(contact => (
            <div key={contact.id} className="portal-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Avatar */}
              {contact.avatar_url ? (
                <img src={contact.avatar_url} alt={contact.name}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--portal-brand-10)',
                  border: '1px solid var(--portal-brand-20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: 'var(--portal-brand)',
                }}>
                  {initials(contact.name)}
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{contact.name}</div>
                {contact.role && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{contact.role}</div>}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#111', border: '1px solid #2e2e2e', textDecoration: 'none', color: '#aaa', fontSize: 12 }}>
                      <Phone size={12} /> Call
                    </a>
                  )}
                  {contact.whatsapp && (
                    <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#111', border: '1px solid #2e2e2e', textDecoration: 'none', color: '#25d366', fontSize: 12 }}>
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#111', border: '1px solid #2e2e2e', textDecoration: 'none', color: '#aaa', fontSize: 12 }}>
                      <Mail size={12} /> Email
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
