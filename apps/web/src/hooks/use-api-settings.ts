import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

const BASE = '/api-config'

// ─── Scopes ──────────────────────────────────────────────────────────────────

export function useApiScopes() {
  return useQuery({
    queryKey: ['api-scopes'],
    queryFn: () => apiFetch(`${BASE}/scopes`),
    staleTime: 60_000 * 10,
  })
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiFetch(`${BASE}/keys`),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: {
      name: string
      scopes: string[]
      environment?: 'live' | 'test'
      description?: string
      expires_at?: string
    }) => apiFetch(`${BASE}/keys`, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${BASE}/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useApiKeyUsage(keyId: string | null, days = 7) {
  return useQuery({
    queryKey: ['api-key-usage', keyId, days],
    queryFn: () => apiFetch(`${BASE}/keys/${keyId}/usage?days=${days}`),
    enabled: !!keyId,
  })
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export function useWebhooks() {
  return useQuery({
    queryKey: ['api-webhooks'],
    queryFn: () => apiFetch(`${BASE}/webhooks`),
  })
}

export function useWebhookEvents() {
  return useQuery({
    queryKey: ['api-webhook-events'],
    queryFn: () => apiFetch(`${BASE}/webhooks/events`),
    staleTime: 60_000 * 10,
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; url: string; events: string[]; secret?: string }) =>
      apiFetch(`${BASE}/webhooks`, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-webhooks'] }),
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; status?: string; events?: string[] }) =>
      apiFetch(`${BASE}/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${BASE}/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-webhooks'] }),
  })
}

export function useWebhookDeliveries(webhookId: string | null) {
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => apiFetch(`${BASE}/webhooks/${webhookId}/deliveries`),
    enabled: !!webhookId,
  })
}

// ─── Access Request (tenant) ─────────────────────────────────────────────────

export function useAccessRequest() {
  return useQuery({
    queryKey: ['api-access-request'],
    queryFn: () => apiFetch(`${BASE}/access-request`),
  })
}

export function useSubmitAccessRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { use_case: string; plan_requested?: string; requested_scopes?: string[] }) =>
      apiFetch(`${BASE}/access-request`, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-access-request'] }),
  })
}

export function useCancelAccessRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch(`${BASE}/access-request`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-access-request'] }),
  })
}

// ─── Super Admin: pending access requests ────────────────────────────────────

export function usePendingApiRequests() {
  return useQuery({
    queryKey: ['super-admin-api-requests'],
    queryFn: () => apiFetch('/super-admin/api-access-requests?status=pending'),
  })
}

export function useReviewApiRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approved, notes }: { id: string; approved: boolean; notes?: string }) =>
      apiFetch(`/super-admin/api-access-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approved, review_notes: notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin-api-requests'] }),
  })
}

// ─── Super Admin: pending key approvals ─────────────────────────────────────

export function usePendingKeyApprovals() {
  return useQuery({
    queryKey: ['super-admin-pending-keys'],
    queryFn: () => apiFetch('/super-admin/api-keys/pending'),
  })
}

export function useApproveApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approved, rate_limit_rpm, rate_limit_daily, rejection_reason }: {
      id: string; approved: boolean; rate_limit_rpm?: number; rate_limit_daily?: number; rejection_reason?: string
    }) =>
      apiFetch(`/super-admin/api-keys/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved, rate_limit_rpm, rate_limit_daily, rejection_reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin-pending-keys'] }),
  })
}
