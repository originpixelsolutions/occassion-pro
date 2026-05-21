-- ============================================================
-- OccasionPro — Migration 001: Extensions & Custom Types
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent";          -- accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "btree_gin";         -- GIN index support

-- ── ENUMS ────────────────────────────────────────────────────

-- Tenant plan tiers
DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'growth', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant status
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles across the platform
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
  'super_admin',
  'company_admin',
  'event_manager',
  'team_member',
  'client',
  'vendor',
  'guest'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event status
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
  'draft',
  'briefing',
  'proposal',
  'confirmed',
  'planning',
  'production',
  'live',
  'completed',
  'cancelled',
  'postponed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event type (broad categories)
DO $$ BEGIN
  CREATE TYPE event_category AS ENUM (
  'wedding',
  'corporate',
  'concert',
  'conference',
  'festival',
  'sports',
  'government',
  'religious',
  'exhibition',
  'educational',
  'virtual',
  'hybrid',
  'private_party',
  'other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task priority
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lead / CRM stage
DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM (
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
  'on_hold'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice status
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'cancelled',
  'refunded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendor contract status
DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
  'draft',
  'sent',
  'signed',
  'active',
  'completed',
  'disputed',
  'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Guest RSVP status
DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('pending', 'accepted', 'declined', 'maybe', 'waitlisted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check-in status
DO $$ BEGIN
  CREATE TYPE checkin_status AS ENUM ('checked_in', 'checked_out', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Risk level
DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Floor plan zone type
DO $$ BEGIN
  CREATE TYPE zone_type AS ENUM (
  'stage',
  'seating',
  'vip',
  'backstage',
  'entrance',
  'exit',
  'booth',
  'food_beverage',
  'green_room',
  'parking',
  'restricted',
  'general'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ticket status
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('active', 'used', 'cancelled', 'refunded', 'transferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Microsite status
DO $$ BEGIN
  CREATE TYPE microsite_status AS ENUM ('draft', 'published', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inventory transaction type
DO $$ BEGIN
  CREATE TYPE inventory_tx_type AS ENUM ('in', 'out', 'damaged', 'lost', 'maintenance', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification channel
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'push', 'sms', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI generation type
DO $$ BEGIN
  CREATE TYPE ai_gen_type AS ENUM (
  'event_brief',
  'proposal',
  'email_draft',
  'risk_assessment',
  'budget_suggestion',
  'vendor_brief',
  'post_event_report',
  'guest_message',
  'social_content',
  'runsheet'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
