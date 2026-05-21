'use client'
/**
 * use-api
 * Simple hook that exposes the typed API client for use inside React components.
 * Wraps the singleton `api` object and adds an optional base-path override.
 */
import { useMemo } from 'react'
import { api } from '@/lib/api'

export function useApi() {
  return useMemo(() => api, [])
}
