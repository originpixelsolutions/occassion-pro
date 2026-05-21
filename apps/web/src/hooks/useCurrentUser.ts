'use client'
/**
 * useCurrentUser
 * Returns the currently authenticated Supabase user and loading state.
 * Thin convenience wrapper over useAuth for components that only need the user object.
 */
import { useAuth } from './use-auth'

export function useCurrentUser() {
  const { user, isLoading } = useAuth()
  return { currentUser: user, isLoading }
}
