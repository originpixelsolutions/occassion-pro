import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function getToken() {
  if (typeof window === 'undefined') return null
  const key = Object.keys(localStorage).find(k => k.includes('supabase') && k.includes('auth'))
  if (!key) return null
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
    return parsed?.access_token ?? parsed?.session?.access_token ?? null
  } catch { return null }
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  return res.json()
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useConferenceSettings(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-settings', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/settings`),
  })
}

export function useUpdateConferenceSettings(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-settings', eventId] }),
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useConferenceDashboard(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-dashboard', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/dashboard`),
    refetchInterval: 30000,
  })
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export function useConferenceTickets(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-tickets', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/tickets`),
  })
}

export function useCreateTicket(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/tickets`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-tickets', eventId] }),
  })
}

export function useUpdateTicket(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-tickets', eventId] }),
  })
}

export function useDeleteTicket(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: string) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/tickets/${ticketId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-tickets', eventId] }),
  })
}

// ─── Registrations ────────────────────────────────────────────────────────────

export function useConferenceRegistrations(tenant: string, eventId: string, params: any = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString()
  return useQuery({
    queryKey: ['conference-registrations', eventId, params],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/registrations${qs ? '?' + qs : ''}`),
  })
}

export function useCreateRegistration(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/registrations`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conference-registrations', eventId] })
      qc.invalidateQueries({ queryKey: ['conference-dashboard', eventId] })
    },
  })
}

export function useCheckIn(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/registrations/check-in`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conference-registrations', eventId] })
      qc.invalidateQueries({ queryKey: ['conference-dashboard', eventId] })
    },
  })
}

// ─── Speakers ─────────────────────────────────────────────────────────────────

export function useConferenceSpeakers(tenant: string, eventId: string, params: any = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString()
  return useQuery({
    queryKey: ['conference-speakers', eventId, params],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/speakers${qs ? '?' + qs : ''}`),
  })
}

export function useCreateSpeaker(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/speakers`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-speakers', eventId] }),
  })
}

export function useUpdateSpeaker(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ speakerId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/speakers/${speakerId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-speakers', eventId] }),
  })
}

export function useDeleteSpeaker(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (speakerId: string) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/speakers/${speakerId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-speakers', eventId] }),
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useConferenceSessions(tenant: string, eventId: string, params: any = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString()
  return useQuery({
    queryKey: ['conference-sessions', eventId, params],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/sessions${qs ? '?' + qs : ''}`),
  })
}

export function useCreateSession(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sessions`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sessions', eventId] }),
  })
}

export function useUpdateSession(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sessions', eventId] }),
  })
}

export function useDeleteSession(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sessions', eventId] }),
  })
}

export function useUpdateSessionStatus(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: string }) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sessions/${sessionId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sessions', eventId] }),
  })
}

// ─── Sponsors ─────────────────────────────────────────────────────────────────

export function useConferenceSponsors(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-sponsors', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/sponsors`),
  })
}

export function useCreateSponsor(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sponsors`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sponsors', eventId] }),
  })
}

export function useUpdateSponsor(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sponsorId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sponsors/${sponsorId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-sponsors', eventId] }),
  })
}

// ─── Exhibitors ───────────────────────────────────────────────────────────────

export function useConferenceExhibitors(tenant: string, eventId: string, params: any = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString()
  return useQuery({
    queryKey: ['conference-exhibitors', eventId, params],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/exhibitors${qs ? '?' + qs : ''}`),
  })
}

export function useCreateExhibitor(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/exhibitors`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-exhibitors', eventId] }),
  })
}

export function useUpdateExhibitor(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exhibitorId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/exhibitors/${exhibitorId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-exhibitors', eventId] }),
  })
}

// ─── Live Q&A ─────────────────────────────────────────────────────────────────

export function useLiveQuestions(tenant: string, eventId: string, sessionId?: string, params: any = {}) {
  const qs = new URLSearchParams({
    ...(sessionId ? { sessionId } : {}),
    ...(params.status ? { status: params.status } : {}),
  }).toString()
  return useQuery({
    queryKey: ['conference-questions', eventId, sessionId, params],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/questions${qs ? '?' + qs : ''}`),
    refetchInterval: 5000,
  })
}

export function useCreateQuestion(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/questions`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['conference-questions', vars.session_id] }),
  })
}

export function useUpdateQuestion(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/questions/${questionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-questions'] }),
  })
}

export function useUpvoteQuestion(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, registration_id }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/questions/${questionId}/upvote`, { method: 'POST', body: JSON.stringify({ registration_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-questions'] }),
  })
}

// ─── Polls ────────────────────────────────────────────────────────────────────

export function useLivePolls(tenant: string, eventId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['conference-polls', eventId, sessionId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/polls${sessionId ? '?sessionId=' + sessionId : ''}`),
    refetchInterval: 5000,
  })
}

export function useCreatePoll(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/polls`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-polls', eventId] }),
  })
}

export function useUpdatePoll(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pollId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/polls/${pollId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-polls', eventId] }),
  })
}

export function useVotePoll(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pollId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-polls', eventId] }),
  })
}

// ─── CEU ──────────────────────────────────────────────────────────────────────

export function useCEUCredits(tenant: string, eventId: string, registrationId?: string) {
  return useQuery({
    queryKey: ['conference-ceu', eventId, registrationId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/ceu${registrationId ? '?registrationId=' + registrationId : ''}`),
  })
}

export function useIssueCEU(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/ceu/issue`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-ceu', eventId] }),
  })
}

// ─── Networking ───────────────────────────────────────────────────────────────

export function useNetworkingConnections(tenant: string, eventId: string, registrationId: string) {
  return useQuery({
    queryKey: ['conference-networking', eventId, registrationId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/networking/${registrationId}`),
    enabled: !!registrationId,
  })
}

export function useCreateConnection(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requesterId, ...data }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/networking/${requesterId}/connect`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-networking', eventId] }),
  })
}

// ─── Convenience aliases used by live/networking/ceu pages ───────────────────

/** All Q&A questions for an event (no session filter) — 5s realtime polling */
export function useUpdateQuestionStatus(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, status }: { questionId: string; status: string }) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/questions/${questionId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-questions'] }),
  })
}

/** Update a poll's status (draft → active → closed) */
export function useUpdatePollStatus(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pollId, status, ...rest }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/polls/${pollId}`, { method: 'PATCH', body: JSON.stringify({ status, ...rest }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-polls', eventId] }),
  })
}

/** CEU credits + registrations bundle for the CEU management page */
export function useConferenceCEU(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-ceu-page', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/ceu`),
  })
}

/** Bulk issue CEU credits to all checked-in attendees of a session */
export function useBulkIssueCEU(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/sessions/${sessionId}/ceu/bulk-issue`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-ceu-page', eventId] }),
  })
}

/** All networking connections for an event (admin view) */
export function useConferenceNetworking(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['conference-networking-all', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/conference/networking`),
  })
}

/** Update a networking connection's status and optional meeting details */
export function useUpdateConnectionStatus(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, status, ...rest }: any) =>
      apiFetch(`/${tenant}/events/${eventId}/conference/networking/connections/${connectionId}`, { method: 'PATCH', body: JSON.stringify({ status, ...rest }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conference-networking-all', eventId] }),
  })
}
