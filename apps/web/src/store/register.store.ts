import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RegisterState {
  // Step 1 — account
  email: string
  fullName: string
  // Step 2 — workspace
  companyName: string
  slug: string
  timezone: string
  logoUrl: string | null
  // Step 3 — plan
  selectedPlan: string
  billingCycle: 'monthly' | 'annual'
  // Progress
  completedStep: number   // 0 = nothing, 1 = account created, 2 = workspace created
  tenantId: string | null
  // Actions
  setAccountData: (email: string, fullName: string) => void
  setWorkspaceData: (data: {
    companyName: string
    slug: string
    timezone: string
    logoUrl?: string | null
  }) => void
  setPlanData: (plan: string, cycle: 'monthly' | 'annual') => void
  setTenantId: (id: string) => void
  setCompletedStep: (step: number) => void
  reset: () => void
}

export const useRegisterStore = create<RegisterState>()(
  persist(
    (set) => ({
      email: '',
      fullName: '',
      companyName: '',
      slug: '',
      timezone: 'Asia/Kolkata',
      logoUrl: null,
      selectedPlan: 'growth',
      billingCycle: 'monthly',
      completedStep: 0,
      tenantId: null,

      setAccountData: (email, fullName) => set({ email, fullName }),
      setWorkspaceData: ({ companyName, slug, timezone, logoUrl = null }) =>
        set({ companyName, slug, timezone, logoUrl }),
      setPlanData: (selectedPlan, billingCycle) => set({ selectedPlan, billingCycle }),
      setTenantId: (tenantId) => set({ tenantId }),
      setCompletedStep: (completedStep) => set({ completedStep }),
      reset: () =>
        set({
          email: '',
          fullName: '',
          companyName: '',
          slug: '',
          timezone: 'Asia/Kolkata',
          logoUrl: null,
          selectedPlan: 'growth',
          billingCycle: 'monthly',
          completedStep: 0,
          tenantId: null,
        }),
    }),
    {
      name: 'op-register',
      storage: {
        getItem: (name) => {
          if (typeof sessionStorage === 'undefined') return null
          return JSON.parse(sessionStorage.getItem(name) ?? 'null')
        },
        setItem: (name, value) => {
          if (typeof sessionStorage === 'undefined') return
          sessionStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          if (typeof sessionStorage === 'undefined') return
          sessionStorage.removeItem(name)
        },
      },
    },
  ),
)
