'use client'

import { use, useState } from 'react'
import { LayoutGrid, Ticket, ShoppingCart, Tag, Settings2 } from 'lucide-react'
import PaymentDashboard    from '@/components/payments/PaymentDashboard'
import TicketTypeManager   from '@/components/payments/TicketTypeManager'
import OrdersList          from '@/components/payments/OrdersList'
import DiscountCodeManager from '@/components/payments/DiscountCodeManager'
import PaymentSettings     from '@/components/payments/PaymentSettings'

type Tab = 'dashboard' | 'tickets' | 'orders' | 'discounts' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard',      icon: LayoutGrid },
  { id: 'tickets',   label: 'Ticket Types',   icon: Ticket },
  { id: 'orders',    label: 'Orders',         icon: ShoppingCart },
  { id: 'discounts', label: 'Discount Codes', icon: Tag },
  { id: 'settings',  label: 'Settings',       icon: Settings2 },
]

export default function PaymentsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Payments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ticketing, orders, and payment gateway management
            </p>
          </div>
        </div>
        <nav className="flex gap-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'dashboard'  && <PaymentDashboard    eventId={eventId} />}
        {activeTab === 'tickets'    && <TicketTypeManager   eventId={eventId} />}
        {activeTab === 'orders'     && <OrdersList          eventId={eventId} />}
        {activeTab === 'discounts'  && <DiscountCodeManager eventId={eventId} />}
        {activeTab === 'settings'   && <PaymentSettings     eventId={eventId} />}
      </div>
    </div>
  )
}
