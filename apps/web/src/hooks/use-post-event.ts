import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

// ─── Status ──────────────────────────────────────────────────────────────────

export function usePostEventStatus(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-status', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/status`),
  })
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export function usePostEventChecklist(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-checklist', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/checklist`),
  })
}

export function useUpdateChecklistItem(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/checklist/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-checklist', eventId] }),
  })
}

export function useCompleteAllChecklist(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/checklist/complete-all`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-checklist', eventId] }),
  })
}

export function useResetChecklist(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/checklist/reset`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-checklist', eventId] }),
  })
}

// ─── Headcount ───────────────────────────────────────────────────────────────

export function useHeadcountRecon(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-headcount', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/headcount`),
  })
}

export function useMarkAttended(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { guest_ids: string[] }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/headcount/mark-attended`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-headcount', eventId] }),
  })
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export function useBudgetRecon(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-budget', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/budget`),
  })
}

export function useFinalizeBudget(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/budget/finalize`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-event-budget', eventId] })
      qc.invalidateQueries({ queryKey: ['post-event-status', eventId] })
    },
  })
}

// ─── Vendor Settlements ──────────────────────────────────────────────────────

export function useVendorSettlements(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-settlements', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/settlements`),
  })
}

export function useSyncSettlements(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/settlements/sync`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-settlements', eventId] }),
  })
}

export function useUpdateSettlement(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ settlementId, data }: { settlementId: string; data: any }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/settlements/${settlementId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-settlements', eventId] }),
  })
}

export function useMarkSettlementPaid(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ settlementId, data }: { settlementId: string; data: any }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/settlements/${settlementId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-event-settlements', eventId] })
      qc.invalidateQueries({ queryKey: ['post-event-status', eventId] })
    },
  })
}

// ─── Thank-You ───────────────────────────────────────────────────────────────

export function useSendThankYou(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/thank-you/send`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-status', eventId] }),
  })
}

// ─── Surveys ─────────────────────────────────────────────────────────────────

export function usePostEventSurveys(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-surveys', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/surveys`),
  })
}

export function useCreateSurvey(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/surveys`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-surveys', eventId] }),
  })
}

export function useSurveyResults(tenant: string, surveyId: string) {
  return useQuery({
    queryKey: ['survey-results', surveyId],
    queryFn: () => apiFetch(`/${tenant}/events/_/post-event/surveys/${surveyId}/results`),
    enabled: !!surveyId,
  })
}

export function useSubmitSurveyResponse(tenant: string, surveyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/_/post-event/surveys/${surveyId}/respond`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['survey-results', surveyId] }),
  })
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function usePostEventReports(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-reports', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/reports`),
  })
}

export function useGenerateReport(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { report_type: 'internal' | 'client' }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/reports/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-event-reports', eventId] })
      qc.invalidateQueries({ queryKey: ['post-event-status', eventId] })
    },
  })
}

export function useGenerateClientReport(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/reports/client`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-reports', eventId] }),
  })
}

// ─── Testimonials ────────────────────────────────────────────────────────────

export function usePostEventTestimonials(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-testimonials', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/testimonials`),
  })
}

export function useCreateTestimonial(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/testimonials`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-testimonials', eventId] }),
  })
}

export function useApproveTestimonial(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/testimonials/${id}/approve`, {
        method: 'PATCH',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-testimonials', eventId] }),
  })
}

export function useFeatureTestimonial(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/testimonials/${id}/feature`, {
        method: 'PATCH',
        body: JSON.stringify({ featured }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-testimonials', eventId] }),
  })
}

export function useDeleteTestimonial(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/testimonials/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-event-testimonials', eventId] }),
  })
}

// ─── Archive ─────────────────────────────────────────────────────────────────

export function useArchiveStatus(tenant: string, eventId: string) {
  return useQuery({
    queryKey: ['post-event-archive-status', eventId],
    queryFn: () => apiFetch(`/${tenant}/events/${eventId}/post-event/archive/status`),
  })
}

export function useArchiveEvent(tenant: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch(`/${tenant}/events/${eventId}/post-event/archive`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-event-archive-status', eventId] })
      qc.invalidateQueries({ queryKey: ['post-event-status', eventId] })
    },
  })
}
