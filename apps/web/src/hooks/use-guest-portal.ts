'use client'
import { useState, useEffect, useCallback } from 'react'
import { getGuestSession, guestApi } from '@/lib/guest-portal-api'

interface GuestContext {
  guestId: string | null
  guestName: string | null
  eventId: string
  isLoggedIn: boolean
  isLoading: boolean
  portalData: any | null
  refresh: () => void
}

export function useGuestPortal(eventId: string): GuestContext {
  const [guestId, setGuestId] = useState<string | null>(null)
  const [guestName, setGuestName] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [portalData, setPortalData] = useState<any>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setIsLoading(true)
    const token = getGuestSession(eventId)
    if (!token) { setIsLoggedIn(false); setIsLoading(false); return }
    try {
      const data = await guestApi.get<any>(`/guest-portal/${eventId}/portal`, eventId)
      setPortalData(data)
      setGuestId(data.guest?.id ?? null)
      setGuestName(data.guest?.name ?? null)
      setIsLoggedIn(true)
    } catch {
      setIsLoggedIn(false)
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  return { guestId, guestName, eventId, isLoggedIn, isLoading, portalData, refresh: load }
}
