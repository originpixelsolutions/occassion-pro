-- ============================================================
-- 020_client_portal.sql
-- White-label Client Collaboration Portal
-- ============================================================

-- ── Portal Branding Configuration ────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,

  -- Branding
  portal_name     TEXT NOT NULL DEFAULT 'Event Portal',
  logo_url        TEXT,
  favicon_url     TEXT,
  cover_image_url TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#6366f1',
  accent_color    TEXT NOT NULL DEFAULT '#8b5cf6',
  background_color TEXT NOT NULL DEFAULT '#0f172a',
  font_family     TEXT NOT NULL DEFAULT 'Inter',

  -- Access
  access_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ,

  -- Feature flags
  show_timeline   BOOLEAN NOT NULL DEFAULT true,
  show_budget     BOOLEAN NOT NULL DEFAULT true,
  show_documents  BOOLEAN NOT NULL DEFAULT true,
  show_moodboard  BOOLEAN NOT NULL DEFAULT true,
  show_vendors    BOOLEAN NOT NULL DEFAULT false,
  show_guestlist  BOOLEAN NOT NULL DEFAULT false,
  show_updates    BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  welcome_message TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(event_id)
);

-- ── Client Updates / Announcements ───────────────────────────
CREATE TABLE IF NOT EXISTS client_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  update_type     TEXT NOT NULL DEFAULT 'general'
                  CHECK (update_type IN (
                    'general','milestone','alert','vendor','finance',
                    'design','logistics','reminder','approval_request'
                  )),
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),

  -- Attachment
  attachment_url  TEXT,
  attachment_name TEXT,

  -- Visibility
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  is_published    BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Reactions
  client_read     BOOLEAN NOT NULL DEFAULT false,
  client_read_at  TIMESTAMPTZ,

  -- Author
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Event Timeline Milestones ─────────────────────────────────
CREATE TABLE IF NOT EXISTS client_timeline_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'planning'
                  CHECK (category IN (
                    'planning','booking','design','logistics',
                    'payment','approval','milestone','delivery'
                  )),

  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN (
                    'upcoming','in_progress','completed','delayed','cancelled'
                  )),

  -- Visibility
  visible_to_client BOOLEAN NOT NULL DEFAULT true,
  requires_client_action BOOLEAN NOT NULL DEFAULT false,

  -- Ordering
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Document Approvals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_type       TEXT,
  file_size_bytes BIGINT,

  document_type   TEXT NOT NULL DEFAULT 'contract'
                  CHECK (document_type IN (
                    'contract','proposal','invoice','design',
                    'floor_plan','mood_board','vendor_quote',
                    'timeline','run_of_show','other'
                  )),

  -- Approval workflow
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (approval_status IN (
                      'pending','under_review','approved','rejected','revision_requested'
                    )),
  approved_by_name  TEXT,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  client_notes      TEXT,

  -- Version
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES client_documents(id),

  -- Visibility
  is_shared       BOOLEAN NOT NULL DEFAULT true,

  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Mood Board ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_moodboard_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT,
  caption         TEXT,
  image_url       TEXT NOT NULL,
  source_url      TEXT,

  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN (
                    'general','decor','floral','lighting','venue',
                    'attire','cake','catering','entertainment',
                    'photography','invitation','color_palette'
                  )),

  -- Client reaction
  client_liked    BOOLEAN,
  client_note     TEXT,
  reacted_at      TIMESTAMPTZ,

  -- Layout hint
  grid_size       TEXT NOT NULL DEFAULT 'medium'
                  CHECK (grid_size IN ('small','medium','large','full')),
  sort_order      INTEGER NOT NULL DEFAULT 0,

  added_by        UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Budget Approval Items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_budget_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  description     TEXT,
  estimated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount    NUMERIC(12,2),

  status          TEXT NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN (
                    'draft','pending_approval','approved',
                    'rejected','revision_requested','on_hold'
                  )),

  -- Client approval
  client_approved_at  TIMESTAMPTZ,
  client_rejected_at  TIMESTAMPTZ,
  client_notes        TEXT,

  -- Manager notes
  internal_notes  TEXT,
  vendor_id       UUID REFERENCES vendors(id),

  -- Flags
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  is_upgrade      BOOLEAN NOT NULL DEFAULT false,

  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Client Messages / Comments ────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Thread
  parent_id       UUID REFERENCES client_messages(id),

  body            TEXT NOT NULL,
  sender_type     TEXT NOT NULL DEFAULT 'team'
                  CHECK (sender_type IN ('team','client')),
  sender_name     TEXT NOT NULL,
  sender_avatar   TEXT,

  -- Reference
  ref_type        TEXT CHECK (ref_type IN (
                    'document','budget_item','timeline','moodboard','general'
                  )),
  ref_id          UUID,

  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_configs_event       ON client_portal_configs(event_id);
CREATE INDEX IF NOT EXISTS idx_portal_configs_token       ON client_portal_configs(access_token);
CREATE INDEX IF NOT EXISTS idx_client_updates_event       ON client_updates(event_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_timeline_event      ON client_timeline_items(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_documents_event     ON client_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_client_moodboard_event     ON client_moodboard_items(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_budget_event        ON client_budget_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_event      ON client_messages(event_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE client_portal_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_updates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_timeline_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_moodboard_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_budget_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_portal_configs
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_updates
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_timeline_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_documents
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_moodboard_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_budget_approvals
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 POLICY tenant_isolation ON client_budget_approvals
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
