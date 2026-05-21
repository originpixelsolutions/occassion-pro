'use client'
import Link from 'next/link'
import { CalendarPlus, Users, FileText, Sparkles } from 'lucide-react'

const ACTIONS = [
  { label: 'New Event', href: '/events/new', icon: CalendarPlus, color: 'text-blue-400 bg-blue-400/10' },
  { label: 'Add Lead', href: '/crm?new=lead', icon: Users, color: 'text-green-400 bg-green-400/10' },
  { label: 'Create Invoice', href: '/finance?new=invoice', icon: FileText, color: 'text-yellow-400 bg-yellow-400/10' },
  { label: 'AI Generate', href: '/ai', icon: Sparkles, color: 'text-violet-400 bg-violet-400/10' },
]

export function QuickActions() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(({ label, href, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-all group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-center leading-tight group-hover:text-primary transition-colors">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
