'use client'

import { use } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, LayoutDashboard, MessageSquare, FileText, DollarSign, CheckSquare, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: LayoutDashboard, href: '' },
  { id: 'messages',   label: 'Messages',   icon: MessageSquare,   href: '/messages' },
  { id: 'documents',  label: 'Documents',  icon: FileText,        href: '/documents' },
  { id: 'budget',     label: 'Budget',     icon: DollarSign,      href: '/budget' },
  { id: 'approvals',  label: 'Approvals',  icon: CheckSquare,     href: '/approvals' },
]

export default function ClientEventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const pathname = usePathname()

  const base = `/${tenant}/client/events/${eventId}`

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur border-b border-white/6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-14 flex items-center gap-3">
            <Link
              href={`/${tenant}/client/dashboard`}
              className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-zinc-500 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-indigo-400" />
              </div>
              <span className="text-sm font-semibold">Client Portal</span>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-0.5 pb-0 overflow-x-auto scrollbar-none">
            {TABS.map(tab => {
              const href = `${base}${tab.href}`
              const isActive = tab.href === ''
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(`${base}${tab.href}`)
              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
