'use client'
import { use, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Leaf, AlertTriangle, Users, PieChart, Info } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const DIET_BREAKDOWN = [
  { key: 'veg_count', label: 'Vegetarian', color: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', desc: 'No meat, fish, or poultry' },
  { key: 'vegan_count', label: 'Vegan', color: '#22c55e', bg: 'bg-green-500/10', text: 'text-green-400', desc: 'No animal products' },
  { key: 'jain_count', label: 'Jain', color: '#84cc16', bg: 'bg-lime-500/10', text: 'text-lime-400', desc: 'No root vegetables, no meat' },
  { key: 'halal_count', label: 'Halal', color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', desc: 'Halal-certified ingredients' },
  { key: 'non_veg_count', label: 'Non-Vegetarian', color: '#f43f5e', bg: 'bg-rose-500/10', text: 'text-rose-400', desc: 'No restrictions' },
  { key: 'gluten_free_count', label: 'Gluten-Free', color: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-400', desc: 'No wheat, barley, rye, or oats' },
]

export default function FnbDietaryPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [dietary, setDietary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token || !tenantId) return
    fetch(`${API}/fnb/events/${eventId}/dietary`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then(setDietary)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [eventId, session, tenantId])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-card border border-border rounded-xl" />
      <div className="h-32 bg-card border border-border rounded-xl" />
    </div>
  )

  const total = dietary?.total_guests ?? 0
  const allergens: string[] = Array.isArray(dietary?.all_allergens)
    ? dietary.all_allergens
    : []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Leaf className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold">Dietary Summary</h2>
        <span className="text-sm text-muted-foreground">· {total} confirmed guests</span>
      </div>

      {total === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No confirmed guests yet</p>
          <p className="text-sm text-muted-foreground">Dietary data populates from confirmed RSVP responses</p>
        </div>
      ) : (
        <>
          {/* Main breakdown cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DIET_BREAKDOWN.map(({ key, label, bg, text, desc }) => {
              const count = dietary?.[key] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={key} className={cn('rounded-xl p-4 border border-border', bg)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold tabular-nums', text)}>{count}</p>
                      <p className="text-sm font-medium mt-0.5">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full bg-background/40', text)}>
                      {pct}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', text.replace('text-', 'bg-'))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Allergen breakdown */}
          {(dietary?.has_allergies_count ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm">Allergen Alerts</h3>
                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full ml-auto">
                  {dietary.has_allergies_count} guests affected
                </span>
              </div>
              {allergens.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allergens.map((allergen: string) => (
                    <span
                      key={allergen}
                      className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-sm font-medium capitalize"
                    >
                      ⚠ {allergen}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Allergen details not collected in RSVP</p>
              )}
              <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-background rounded-lg p-3 border border-border">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                <p>Ensure your catering vendor is briefed on all allergen requirements. Cross-contamination risks must be communicated for buffet setups.</p>
              </div>
            </div>
          )}

          {/* Catering brief tips */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-blue-400" />
              <h3 className="font-semibold text-sm">Catering Brief Summary</h3>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {(dietary?.veg_count + dietary?.vegan_count + dietary?.jain_count) > 0 && (
                <div className="flex items-start gap-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p>
                    <span className="text-emerald-400 font-medium">
                      {dietary.veg_count + dietary.vegan_count + dietary.jain_count} plant-based guests
                    </span>
                    {' '}({dietary.veg_count} veg, {dietary.vegan_count} vegan, {dietary.jain_count} jain).
                    Ensure dedicated vegetarian section with no cross-contamination from meat dishes.
                  </p>
                </div>
              )}
              {dietary?.halal_count > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                  <span className="text-amber-400 text-xs mt-0.5 shrink-0">H</span>
                  <p>
                    <span className="text-amber-400 font-medium">{dietary.halal_count} halal guests</span>.
                    Source halal-certified meats. Maintain separate cooking utensils if serving non-halal dishes.
                  </p>
                </div>
              )}
              {dietary?.gluten_free_count > 0 && (
                <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                  <span className="text-blue-400 text-xs mt-0.5 shrink-0">GF</span>
                  <p>
                    <span className="text-blue-400 font-medium">{dietary.gluten_free_count} gluten-free guests</span>.
                    Provide clearly labelled GF items. Avoid using shared fryers or contaminated serving utensils.
                  </p>
                </div>
              )}
              {(dietary?.veg_count + dietary?.vegan_count + dietary?.jain_count + dietary?.halal_count + dietary?.gluten_free_count) === 0 && (
                <p className="text-center text-muted-foreground py-4">No special dietary requirements detected from confirmed guests.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
