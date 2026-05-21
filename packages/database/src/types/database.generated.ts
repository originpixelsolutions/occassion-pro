// ============================================================
// OccasionPro — Generated Supabase TypeScript Types
// Run `pnpm db:types` to regenerate from live Supabase schema
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── ENUMS ────────────────────────────────────────────────────

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise' | 'white_label'
export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled'
export type UserRole = 'super_admin' | 'company_admin' | 'event_manager' | 'team_member' | 'client' | 'vendor' | 'guest'
export type EventStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'
export type EventCategory =
  | 'wedding' | 'corporate' | 'conference' | 'concert' | 'exhibition'
  | 'government' | 'sports' | 'religious' | 'educational' | 'virtual' | 'other'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled'
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'active' | 'completed' | 'terminated' | 'disputed'
export type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'waitlisted' | 'attended' | 'no_show'
export type CheckinStatus = 'checked_in' | 'checked_out' | 'denied' | 'walk_in'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ZoneType = 'stage' | 'seating' | 'vip' | 'networking' | 'registration' | 'food' | 'booth' | 'backstage' | 'parking' | 'other'
export type TicketStatus = 'active' | 'used' | 'cancelled' | 'transferred' | 'refunded' | 'expired'
export type MicrositeStatus = 'draft' | 'published' | 'unpublished' | 'archived'
export type InventoryTxType = 'purchase' | 'sale' | 'rent_out' | 'return' | 'damage' | 'loss' | 'maintenance' | 'adjustment'
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp' | 'push'
export type AiGenType =
  | 'proposal_draft' | 'email_draft' | 'event_description' | 'task_suggestions'
  | 'budget_estimate' | 'vendor_recommendation' | 'risk_analysis' | 'runsheet_generation'
  | 'guest_communication' | 'post_event_report' | 'social_media_post' | 'other'

// ── DATABASE TYPES ────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: PlanTier
          status: TenantStatus
          logo_url: string | null
          primary_color: string | null
          accent_color: string | null
          custom_domain: string | null
          country: string
          currency: string
          timezone: string
          razorpay_account_id: string | null
          max_users: number
          max_events_per_month: number
          settings: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          timezone: string
          language: string
          is_super_admin: boolean
          last_seen_at: string | null
          settings: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: UserRole
          is_active: boolean
          assigned_by: string | null
          assigned_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'assigned_at'>
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>
      }
      events: {
        Row: {
          id: string
          tenant_id: string
          name: string
          category: EventCategory
          status: EventStatus
          start_date: string | null
          end_date: string | null
          venue_id: string | null
          address_line1: string | null
          city: string | null
          state: string | null
          country: string
          expected_guests: number
          actual_guests: number
          budget_amount: number | null
          actual_spend: number | null
          currency: string
          description: string | null
          internal_notes: string | null
          tags: string[]
          microsite_enabled: boolean
          is_archived: boolean
          ai_risk_score: number | null
          ai_risk_flags: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      event_tasks: {
        Row: {
          id: string
          tenant_id: string
          event_id: string
          phase_id: string | null
          parent_task_id: string | null
          title: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          assigned_to: string | null
          due_date: string | null
          completed_at: string | null
          estimated_hours: number | null
          actual_hours: number | null
          depends_on: string[]
          tags: string[]
          metadata: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['event_tasks']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['event_tasks']['Insert']>
      }
      leads: {
        Row: {
          id: string
          tenant_id: string
          company_id: string | null
          contact_id: string | null
          title: string
          stage: LeadStage
          probability: number
          estimated_value: number | null
          currency: string
          source: string | null
          assigned_to: string | null
          next_follow_up: string | null
          lost_reason: string | null
          tags: string[]
          metadata: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          tenant_id: string
          event_id: string | null
          company_id: string | null
          invoice_number: string
          status: InvoiceStatus
          issue_date: string
          due_date: string
          subtotal: number
          tax_amount: number
          discount_amount: number
          total: number
          paid_amount: number
          balance_due: number
          currency: string
          razorpay_payment_link_id: string | null
          razorpay_payment_link_url: string | null
          notes: string | null
          metadata: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'balance_due' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      guests: {
        Row: {
          id: string
          tenant_id: string
          event_id: string
          category_id: string | null
          full_name: string
          email: string | null
          phone: string | null
          company: string | null
          designation: string | null
          avatar_url: string | null
          rsvp_status: RsvpStatus
          rsvp_at: string | null
          rsvp_token: string
          plus_one_allowed: boolean
          plus_one_name: string | null
          plus_one_email: string | null
          dietary_requirements: string[]
          accessibility_needs: string | null
          table_element_id: string | null
          seat_number: string | null
          qr_code: string
          qr_code_url: string | null
          ticket_id: string | null
          apple_wallet_pass_url: string | null
          google_wallet_pass_url: string | null
          is_walk_in: boolean
          source: string | null
          notes: string | null
          metadata: Json
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['guests']['Row'], 'id' | 'rsvp_token' | 'qr_code' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['guests']['Insert']>
      }
      vendors: {
        Row: {
          id: string
          tenant_id: string
          name: string
          email: string | null
          phone: string | null
          website: string | null
          city: string | null
          country: string
          gstin: string | null
          pan: string | null
          tags: string[]
          rating: number | null
          is_artist: boolean
          artist_type: string | null
          rider_requirements: string | null
          razorpay_fund_account_id: string | null
          user_id: string | null
          notes: string | null
          metadata: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
      }
      microsites: {
        Row: {
          id: string
          tenant_id: string
          event_id: string
          status: MicrositeStatus
          subdomain: string | null
          custom_domain: string | null
          title: string
          tagline: string | null
          description: string | null
          hero_image_url: string | null
          hero_video_url: string | null
          meta_title: string | null
          meta_description: string | null
          og_image_url: string | null
          primary_color: string
          accent_color: string
          logo_url: string | null
          show_schedule: boolean
          show_speakers: boolean
          show_sponsors: boolean
          show_gallery: boolean
          show_map: boolean
          show_countdown: boolean
          enable_ticketing: boolean
          enable_rsvp: boolean
          require_approval: boolean
          page_views: number
          unique_visitors: number
          published_at: string | null
          unpublished_at: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['microsites']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['microsites']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          tenant_id: string
          purchase_id: string
          event_id: string
          tier_id: string
          guest_id: string | null
          ticket_number: string
          holder_name: string | null
          holder_email: string | null
          qr_code: string
          qr_code_url: string | null
          status: TicketStatus
          apple_wallet_pass_url: string | null
          google_wallet_pass_url: string | null
          transferred_to: string | null
          transferred_at: string | null
          used_at: string | null
          used_at_zone_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'ticket_number' | 'qr_code' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
      }
      inventory_items: {
        Row: {
          id: string
          tenant_id: string
          category_id: string | null
          name: string
          sku: string | null
          barcode: string | null
          qr_code: string
          description: string | null
          unit: string
          quantity_total: number
          quantity_available: number
          quantity_in_use: number
          quantity_damaged: number
          reorder_level: number
          unit_cost: number | null
          replacement_cost: number | null
          storage_location: string | null
          is_rentable: boolean
          rental_rate_per_day: number | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory_items']['Row'], 'id' | 'qr_code' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>
      }
      ai_generations: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          type: AiGenType
          model: string
          prompt_tokens: number | null
          completion_tokens: number | null
          total_tokens: number | null
          latency_ms: number | null
          resource_type: string | null
          resource_id: string | null
          prompt: string | null
          output: string | null
          was_accepted: boolean | null
          feedback: string | null
          cost_usd: number | null
          metadata: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_generations']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['ai_generations']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      current_user_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      belongs_to_tenant: {
        Args: { row_tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      plan_tier: PlanTier
      tenant_status: TenantStatus
      user_role: UserRole
      event_status: EventStatus
      event_category: EventCategory
      task_status: TaskStatus
      task_priority: TaskPriority
      lead_stage: LeadStage
      invoice_status: InvoiceStatus
      payment_status: PaymentStatus
      contract_status: ContractStatus
      rsvp_status: RsvpStatus
      checkin_status: CheckinStatus
      risk_level: RiskLevel
      zone_type: ZoneType
      ticket_status: TicketStatus
      microsite_status: MicrositeStatus
      inventory_tx_type: InventoryTxType
      notification_channel: NotificationChannel
      ai_gen_type: AiGenType
    }
  }
}
