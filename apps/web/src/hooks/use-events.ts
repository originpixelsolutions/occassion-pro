'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useEvents(params?: { search?: string; status?: string }) {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()

  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.get<{ data: any[]; count: number }>(`/events${qs ? `?${qs}` : ''}`),
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => api.get<any>(`/events/${eventId}`),
    enabled: !!eventId,
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['events', 'dashboard-stats'],
    queryFn: () => api.get<any>('/events/stats/dashboard'),
    staleTime: 60 * 1000,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/events', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.put(`/events/${eventId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', eventId] })
      qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
