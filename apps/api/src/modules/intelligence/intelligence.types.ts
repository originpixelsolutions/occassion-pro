export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface SmartAlert {
  id?: string
  tenant_id: string
  event_id?: string | null
  alert_type: string
  severity: AlertSeverity
  title: string
  message: string
  metadata: Record<string, unknown>
  is_dismissed?: boolean
  dismissed_by?: string | null
  dismissed_at?: string | null
  expires_at?: string | null
  created_at?: string
}

export interface DimensionScores {
  guests: number
  finance: number
  vendors: number
  runsheet: number
  fnb: number
  team: number
}

export interface EventHealthScore {
  id: string
  event_id: string
  overall_score: number
  dimension_scores: DimensionScores
  computed_at: string
  next_compute_at: string | null
  alert_count_critical: number
  alert_count_warning: number
  alert_count_info: number
}

/** Deduction per severity for score computation */
export const SCORE_DEDUCTIONS: Record<AlertSeverity, number> = {
  critical: 15,
  warning: 5,
  info: 1,
}

/** Which dimensions each alert_type belongs to (for dimension sub-scores) */
export const ALERT_DIMENSION_MAP: Record<string, keyof DimensionScores> = {
  rsvp_response_rate_low: 'guests',
  guest_capacity_near: 'guests',
  guests_unassigned_tables: 'guests',
  vip_rsvp_unconfirmed: 'guests',

  budget_overrun_warning: 'finance',
  budget_overrun_critical: 'finance',
  unpaid_vendors: 'finance',
  payment_gateway_missing: 'finance',

  vendor_unconfirmed: 'vendors',
  vendor_declined: 'vendors',
  vendor_performance_risk: 'vendors',

  runsheet_empty: 'runsheet',
  runsheet_gap: 'runsheet',
  runsheet_overlap: 'runsheet',

  fnb_quantities_missing: 'fnb',
  fnb_dietary_unacknowledged: 'fnb',

  team_coverage_low: 'team',
  event_manager_missing: 'team',
}
