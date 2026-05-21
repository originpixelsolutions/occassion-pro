-- ============================================================
-- 064_vendor_portal.sql
-- Vendor Portal: global vendor accounts, sessions, assignments,
-- messaging, and performance scoring
-- ============================================================

-- ── vendor_accounts ──────────────────────────────────────────
-- Global vendor accounts (not tenant-scoped; one account per email)
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  business_name  TEXT,
  phone          TEXT,
  category       TEXT NOT NULL DEFAULT 'Other'
                   CHECK (category IN (
                     'Catering','Photography','Decor','AV','Transport',
                     'Security','Entertainment','Venue','Floral','Cake',
                     'Makeup','Invitations','Lighting','Staffing','Other'
                   )),
  website        TEXT,
  bio            TEXT,
  avatar_url     TEXT,
  gstin          TEXT,
  -- Bank details stored encrypted at the application layer
  bank_account_name    TEXT,
  bank_account_number  TEXT,   -- store pgp-encrypted or app-encrypted
  bank_ifsc            TEXT,
  password_hash  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_accounts_email    ON vendor_accounts (email);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_category ON vendor_accounts (category);

-- ── vendor_portal_sessions ───────────────────────────────────
-- UUID primary key IS the session token (same pattern as client portal)
CREATE TABLE IF NOT EXISTS vendor_portal_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_sessions_vendor_id  ON vendor_portal_sessions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sessions_expires_at ON vendor_portal_sessions (expires_at);

-- ── vendor_password_reset_tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  purpose     TEXT NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset','set_password')),
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_pwd_token_hash ON vendor_password_reset_tokens (token_hash);

-- ── vendor_event_assignments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_event_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE RESTRICT,
  event_id            UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  service_description TEXT,
  agreed_amount       DECIMAL(12,2),
  currency_code       TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN (
                          'invited','confirmed','in_progress',
                          'completed','cancelled','declined'
                        )),
  assigned_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  -- Staff ratings / notes (hidden from vendor)
  tenant_rating       SMALLINT CHECK (tenant_rating BETWEEN 1 AND 5),
  vendor_notes        TEXT,      -- internal staff notes
  -- Vendor response
  vendor_response_note TEXT,
  responded_at        TIMESTAMPTZ,
  -- Timestamps
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (vendor_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_vea_vendor_id  ON vendor_event_assignments (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vea_event_id   ON vendor_event_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_vea_tenant_id  ON vendor_event_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vea_status     ON vendor_event_assignments (status);

-- ── vendor_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES vendor_event_assignments (id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('team','vendor')),
  sender_id       UUID,   -- profiles.id if team, vendor_accounts.id if vendor
  content         TEXT NOT NULL,
  is_read_by_vendor BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_by_team   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_messages_assignment_id ON vendor_messages (assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_messages_created_at    ON vendor_messages (created_at);

-- ── vendor_performance_scores (view) ─────────────────────────
CREATE OR REPLACE VIEW vendor_performance_scores AS
SELECT
  va.id                                               AS vendor_id,
  va.name                                             AS vendor_name,
  va.category,
  COUNT(vea.id)                                       AS total_assignments,
  COUNT(vea.id) FILTER (WHERE vea.status = 'completed') AS completed_assignments,
  ROUND(AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL), 2)
                                                      AS avg_rating,
  -- Simple performance score: 50% completion rate + 50% avg rating (normalised to 20)
  ROUND(
    COALESCE(
      (COUNT(vea.id) FILTER (WHERE vea.status = 'completed')::NUMERIC /
       NULLIF(COUNT(vea.id), 0)) * 50, 0
    ) +
    COALESCE(
      (AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL) / 5.0) * 50, 0
    ),
  0)                                                  AS score
FROM vendor_accounts va
LEFT JOIN vendor_event_assignments vea ON vea.vendor_id = va.id
GROUP BY va.id, va.name, va.category;

-- ── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_vendor_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_accounts_updated_at ON vendor_accounts;
CREATE TRIGGER trg_vendor_accounts_updated_at
  BEFORE UPDATE ON vendor_accounts
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();

DROP TRIGGER IF EXISTS trg_vea_updated_at ON vendor_event_assignments;
CREATE TRIGGER trg_vea_updated_at
  BEFORE UPDATE ON vendor_event_assignments
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();
