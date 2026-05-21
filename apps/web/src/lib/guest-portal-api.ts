/**
 * Guest Portal API client
 * Reads session token from localStorage, sends as X-Guest-Session header
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api'

export function getGuestSession(eventId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`gp_session_${eventId}`)
}

export function setGuestSession(eventId: string, token: string) {
  localStorage.setItem(`gp_session_${eventId}`, token)
}

export function clearGuestSession(eventId: string) {
  localStorage.removeItem(`gp_session_${eventId}`)
}

async function guestFetch<T>(
  path: string,
  eventId: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getGuestSession(eventId)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['X-Guest-Session'] = token

  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearGuestSession(eventId)
    throw new Error('SESSION_EXPIRED')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export const guestApi = {
  get: <T>(path: string, eventId: string) =>
    guestFetch<T>(path, eventId, { method: 'GET' }),

  post: <T>(path: string, eventId: string, body?: unknown) =>
    guestFetch<T>(path, eventId, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(path: string, eventId: string, body?: unknown) =>
    guestFetch<T>(path, eventId, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  // Public (no session needed)
  public: {
    get: async <T>(path: string): Promise<T> => {
      const res = await fetch(`${API}${path}`)
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    post: async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Request failed')
      return data
    },
  },
}
