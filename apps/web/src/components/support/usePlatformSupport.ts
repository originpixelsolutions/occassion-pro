'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    // Try Supabase local storage key
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') && key.includes('auth')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          return parsed?.access_token ?? parsed?.access_token ?? ''
        }
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  score?: number
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_type: 'user' | 'bot' | 'super_admin'
  sender_id: string | null
  message: string
  created_at: string
}

export interface SupportTicket {
  id: string
  ticket_number: string
  title: string
  subject?: string
  description: string
  status: 'open' | 'bot_handled' | 'escalated' | 'in_progress' | 'resolved' | 'closed'
  priority: string
  bot_faq_id: string | null
  escalated_at: string | null
  created_at: string
  updated_at: string
  bot_answer?: FAQ | null
  support_messages?: SupportMessage[]
  _msg_count?: { count: number }[]
}

export function usePlatformSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadTickets = useCallback(async () => {
    try {
      const data = await apiFetch('/support/help')
      setTickets(data)
    } catch {}
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch('/support/faqs/categories')
      setCategories(data)
    } catch {}
  }, [])

  useEffect(() => {
    loadTickets()
    loadCategories()
  }, [loadTickets, loadCategories])

  const searchFaqs = async (query: string): Promise<FAQ[]> => {
    if (!query.trim()) return []
    try {
      return await apiFetch(`/support/faqs?q=${encodeURIComponent(query)}`)
    } catch {
      return []
    }
  }

  const getFaqsByCategory = async (category: string): Promise<FAQ[]> => {
    try {
      return await apiFetch(`/support/faqs?category=${encodeURIComponent(category)}`)
    } catch {
      return []
    }
  }

  const createTicket = async (dto: {
    subject: string
    description: string
    category: string
  }): Promise<SupportTicket> => {
    setSubmitting(true)
    try {
      const ticket = await apiFetch('/support/help', {
        method: 'POST',
        body: JSON.stringify(dto),
      })
      await loadTickets()
      return ticket
    } finally {
      setSubmitting(false)
    }
  }

  const getTicket = async (id: string): Promise<SupportTicket> => {
    return apiFetch(`/support/help/${id}`)
  }

  const addMessage = async (ticketId: string, message: string) => {
    return apiFetch(`/support/help/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  const escalate = async (ticketId: string) => {
    const result = await apiFetch(`/support/help/${ticketId}/escalate`, { method: 'POST' })
    await loadTickets()
    return result
  }

  const resolve = async (ticketId: string) => {
    const result = await apiFetch(`/support/help/${ticketId}/resolve`, { method: 'POST' })
    await loadTickets()
    return result
  }

  const openTicketCount = tickets.filter(t =>
    ['open', 'bot_handled', 'escalated', 'in_progress'].includes(t.status)
  ).length

  return {
    tickets,
    categories,
    loading,
    submitting,
    openTicketCount,
    loadTickets,
    searchFaqs,
    getFaqsByCategory,
    createTicket,
    getTicket,
    addMessage,
    escalate,
    resolve,
  }
}
