'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

export function useAuth() {
  const { user, session, profile, isLoading, setUser, setSession, setProfile, setLoading, reset } =
    useAuthStore()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_OUT') {
        reset()
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, profile, isLoading, signOut }
}
