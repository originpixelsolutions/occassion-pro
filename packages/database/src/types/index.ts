export type { Database, Json } from './database.generated'
export type {
  PlanTier,
  TenantStatus,
  UserRole,
  EventStatus,
  EventCategory,
  TaskStatus,
  TaskPriority,
  LeadStage,
  InvoiceStatus,
  PaymentStatus,
  ContractStatus,
  RsvpStatus,
  CheckinStatus,
  RiskLevel,
  ZoneType,
  TicketStatus,
  MicrositeStatus,
  InventoryTxType,
  NotificationChannel,
  AiGenType,
} from './database.generated'

// Row type helpers
import type { Database } from './database.generated'
type Tables = Database['public']['Tables']

export type Tenant = Tables['tenants']['Row']
export type TenantInsert = Tables['tenants']['Insert']
export type TenantUpdate = Tables['tenants']['Update']

export type Profile = Tables['profiles']['Row']
export type ProfileInsert = Tables['profiles']['Insert']
export type ProfileUpdate = Tables['profiles']['Update']

export type UserRoleRow = Tables['user_roles']['Row']
export type UserRoleInsert = Tables['user_roles']['Insert']

export type Event = Tables['events']['Row']
export type EventInsert = Tables['events']['Insert']
export type EventUpdate = Tables['events']['Update']

export type EventTask = Tables['event_tasks']['Row']
export type EventTaskInsert = Tables['event_tasks']['Insert']
export type EventTaskUpdate = Tables['event_tasks']['Update']

export type Lead = Tables['leads']['Row']
export type LeadInsert = Tables['leads']['Insert']
export type LeadUpdate = Tables['leads']['Update']

export type Invoice = Tables['invoices']['Row']
export type InvoiceInsert = Tables['invoices']['Insert']
export type InvoiceUpdate = Tables['invoices']['Update']

export type Guest = Tables['guests']['Row']
export type GuestInsert = Tables['guests']['Insert']
export type GuestUpdate = Tables['guests']['Update']

export type Vendor = Tables['vendors']['Row']
export type VendorInsert = Tables['vendors']['Insert']
export type VendorUpdate = Tables['vendors']['Update']

export type Microsite = Tables['microsites']['Row']
export type MicrositeInsert = Tables['microsites']['Insert']
export type MicrositeUpdate = Tables['microsites']['Update']

export type Ticket = Tables['tickets']['Row']
export type TicketInsert = Tables['tickets']['Insert']
export type TicketUpdate = Tables['tickets']['Update']

export type InventoryItem = Tables['inventory_items']['Row']
export type InventoryItemInsert = Tables['inventory_items']['Insert']
export type InventoryItemUpdate = Tables['inventory_items']['Update']

export type AiGeneration = Tables['ai_generations']['Row']
export type AiGenerationInsert = Tables['ai_generations']['Insert']

// ── COMPOSITE / JOINED TYPES ─────────────────────────────────

export type EventWithVenue = Event & {
  venues?: {
    id: string
    name: string
    city: string
    address_line1: string | null
  } | null
}

export type TaskWithAssignee = EventTask & {
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type GuestWithCategory = Guest & {
  guest_categories?: {
    id: string
    name: string
    color: string
    badge_color: string
  } | null
}

export type InvoiceWithItems = Invoice & {
  invoice_line_items?: {
    id: string
    description: string
    quantity: number
    unit_price: number
    tax_pct: number
    amount: number
  }[]
}

// ── PAGINATION HELPERS ───────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface QueryOptions {
  page?: number
  pageSize?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  search?: string
}
