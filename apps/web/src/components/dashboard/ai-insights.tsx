'use client'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

const TIPS = [
  'You have 3 events in the next 7 days. Review staffing.',
  '2 vendor contracts are pending signature.',
  'Budget utilisation is at 78% for TechSummit 2026.',
]

export function AIInsights() {
  return (
    <div className="bg-card border border-violet-500/20 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold">AI Insights</h2>
      </div>
      <div className="space-y-2">
        {TIPS.map((tip, i) => (
          <div key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
            <span className="text-violet-400 shrink-0 mt-0.5">•</span>
            {tip}
          </div>
        ))}
      </div>
      <Link
        href="/ai"
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
      >
        Open AI Assistant <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
