'use client'

import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SupportDrawer } from './SupportDrawer'
import { usePlatformSupport } from './usePlatformSupport'

/**
 * SupportWidget — floating action button (bottom-right corner).
 * Opens the SupportDrawer when clicked. Shows a badge for open tickets.
 */
export function SupportWidget() {
  const [open, setOpen]   = useState(false)
  const { openTicketCount } = usePlatformSupport()

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open support"
        className={cn(
          'fixed bottom-6 right-6 z-[997] w-14 h-14 rounded-full shadow-2xl',
          'bg-violet-600 hover:bg-violet-700 active:scale-95',
          'flex items-center justify-center transition-all duration-200',
          open && 'rotate-90',
        )}
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <HelpCircle className="w-6 h-6 text-white" />
        }

        {/* Open ticket badge */}
        {!open && openTicketCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-lg">
            {openTicketCount > 9 ? '9+' : openTicketCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      <SupportDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
