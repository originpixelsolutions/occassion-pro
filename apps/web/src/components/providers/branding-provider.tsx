'use client'

import { createContext, useContext, ReactNode } from 'react'
import { BrandingTokenSet, DEFAULT_BRANDING } from '@/lib/branding'
import { useBranding } from '@/hooks/use-branding'

interface BrandingContextValue {
  branding: BrandingTokenSet
  loading: boolean
  reload: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  loading: false,
  reload: async () => {},
})

export function BrandingProvider({ children }: { children: ReactNode }) {
  const value = useBranding()
  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export const useBrandingContext = () => useContext(BrandingContext)
