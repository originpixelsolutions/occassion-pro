'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, UtensilsCrossed, LayoutGrid, List, Ticket, ScanLine, BarChart2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuBuilder } from '@/components/fnb/MenuBuilder'
import { TokenManager } from '@/components/fnb/TokenManager'
import { RedemptionScanner } from '@/components/fnb/RedemptionScanner'
import { ConsumptionReport } from '@/components/fnb/ConsumptionReport'
import { FnbBudgetCard } from '@/components/fnb/FnbBudgetCard'
import { FnbDashboardWidgets } from '@/components/fnb/FnbDashboardWidgets'

type Tab = 'dashboard' | 'menus' | 'tokens' | 'scanner' | 'consumption' | 'budget'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',   label: 'Dashboard',     icon: LayoutGrid },
  { id: 'menus',       label: 'Menus & Items',  icon: List },
  { id: 'tokens',      label: 'Tokens',         icon: Ticket },
  { id: 'scanner',     label: 'Scanner',        icon: ScanLine },
  { id: 'consumption', label: 'Consumption',    icon: BarChart2 },
  { id: 'budget',      label: 'Budget',         icon: Wallet },
]

export default function FnbPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event
        </Link>
        <span>/</span>
        <span className="flex items-center gap-1.5 text-foreground font-medium">
          <UtensilsCrossed className="w-3.5 h-3.5" /> Food &amp; Beverage
        </span>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Food &amp; Beverage</h1>
            <p className="text-sm text-muted-foreground">
              Manage menus, tokens, serving stations, and consumption tracking
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-all',
                activeTab === id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-primary/40',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'dashboard'   && <FnbDashboardWidgets eventId={eventId} />}
          {activeTab === 'menus'       && <MenuBuilder eventId={eventId} />}
          {activeTab === 'tokens'      && <TokenManager eventId={eventId} />}
          {activeTab === 'scanner'     && <RedemptionScanner eventId={eventId} />}
          {activeTab === 'consumption' && <ConsumptionReport eventId={eventId} />}
          {activeTab === 'budget'      && <FnbBudgetCard eventId={eventId} />}
        </div>
      </div>
    </div>
  )
}
