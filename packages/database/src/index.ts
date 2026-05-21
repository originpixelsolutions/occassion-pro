// ── CLIENT ───────────────────────────────────────────────────
export {
  createBrowserClient,
  createServerClient,
  createServiceClient,
  getSupabaseEnv,
} from './client'
export type { TypedSupabaseClient } from './client'

// ── TYPES ─────────────────────────────────────────────────────
export type {
  Database,
  Json,
  // Enums
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
  // Row types
  Tenant, TenantInsert, TenantUpdate,
  Profile, ProfileInsert, ProfileUpdate,
  UserRoleRow, UserRoleInsert,
  Event, EventInsert, EventUpdate,
  EventTask, EventTaskInsert, EventTaskUpdate,
  Lead, LeadInsert, LeadUpdate,
  Invoice, InvoiceInsert, InvoiceUpdate,
  Guest, GuestInsert, GuestUpdate,
  Vendor, VendorInsert, VendorUpdate,
  Microsite, MicrositeInsert, MicrositeUpdate,
  Ticket, TicketInsert, TicketUpdate,
  InventoryItem, InventoryItemInsert, InventoryItemUpdate,
  AiGeneration, AiGenerationInsert,
  // Composite types
  EventWithVenue, TaskWithAssignee, GuestWithCategory, InvoiceWithItems,
  // Utility types
  PaginatedResult, QueryOptions,
} from './types'

// ── HELPERS ───────────────────────────────────────────────────
export {
  applyPagination,
  buildPaginatedResult,
  applySearch,
} from './helpers/pagination'

export {
  getCurrentUserTenant,
  getCurrentUserRole,
  hasRole,
  tenantQuery,
} from './helpers/tenant'
