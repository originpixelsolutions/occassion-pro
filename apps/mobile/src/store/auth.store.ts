import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'

interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url?: string
  tenant_id: string
  role: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  setSession: session =>
    set({
      session,
      user: session?.user ?? null,
    }),

  setProfile: profile => set({ profile }),

  setLoading: isLoading => set({ isLoading }),

  signOut: () =>
    set({
      session: null,
      user: null,
      profile: null,
    }),
}))
