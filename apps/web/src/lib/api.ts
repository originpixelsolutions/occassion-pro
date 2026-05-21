import { getSupabaseBrowserClient } from './supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  /** Fetch a raw response as a Blob (e.g. for CSV/file downloads) */
  getRaw: async (path: string): Promise<Blob> => {
    const token = await getAccessToken()
    const res = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)
    return res.blob()
  },
}
