-- =============================================================================
-- OccasionPro Migration 053 — Notification Centre
--
-- Tables:
--   notifications              → all notifications across portals
--   notification_preferences   → per-user per-module muting/channel prefs
--
-- Functions:
--   create_notification()      → insert with preference check, return id
--   mark_notifications_read()  → batch mark read, return count
--   get_unread_count()         → fast unread badge count
--
-- Real-time:
--   Supabase Realtime publication on notifications table (recipient_id filter)
-- =============================================================================

-- ─── Enum types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_recipient_type AS ENUM (
    'team',    -- workspace team member
    'guest',   -- event guest
    'client',  -- client portal user
    'vendor'   -- vendor portal user
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_module AS ENUM (
    'guests',       -- guest management actions
    'finance',      -- payments, budgets, invoices
    'fnb',          -- food & beverage
    'floorplan',    -- floor plan changes
    'runsheet',     -- runsheet updates
    'vendors',      -- vendor assignments, declines
    'clients',      -- client actions
    'team',         -- team changes, removals
    'conference',   -- conference / session module
    'post_event',   -- post-event feedback, reports
    'system'        -- platform-level alerts
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_urgency AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,

  recipient_id     UUID NOT NULL,   -- user_id / guest_id / client_id / vendor_id
  recipient_type   notification_recipient_type NOT NULL,

  module           notification_module NOT NULL,
  urgency          notification_urgency NOT NULL DEFAULT 'info',

  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  action_url       TEXT,            -- deep-link to the relevant page

  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,

  -- batching support: reference to first notification in a batch group
  batch_key        TEXT,            -- e.g. "finance:event_id:2026-05-17T10" — same key = same batch
  batch_count      INT NOT NULL DEFAULT 1,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast unread badge and inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_event
  ON notifications(tenant_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_batch_key
  ON notifications(batch_key, created_at DESC)
  WHERE batch_key IS NOT NULL;

-- ─── notification_preferences ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  recipient_type    notification_recipient_type NOT NULL,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,

  module            notification_module NOT NULL,
  urgency_threshold notification_urgency NOT NULL DEFAULT 'info',  -- min urgency to receive
  in_app_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tenant_id, module)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user
  ON notification_preferences(user_id, recipient_type);

-- ─── Trigger: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_updated_at();

-- ─── Function: create_notification ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id       UUID,
  p_event_id        UUID,
  p_recipient_id    UUID,
  p_recipient_type  notification_recipient_type,
  p_module          notification_module,
  p_title           TEXT,
  p_body            TEXT,
  p_action_url      TEXT DEFAULT NULL,
  p_urgency         notification_urgency DEFAULT 'info',
  p_batch_key       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_pref           notification_preferences%ROWTYPE;
  v_urgency_rank   INT;
  v_threshold_rank INT;
  v_notification_id UUID;
  v_batch_count    INT;
  v_existing_batch UUID;
BEGIN
  -- Check preferences (only for team members who have explicit prefs)
  SELECT * INTO v_pref
  FROM notification_preferences
  WHERE user_id = p_recipient_id
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND module = p_module
  LIMIT 1;

  -- If preference exists and in_app is disabled, skip
  IF FOUND AND NOT v_pref.in_app_enabled THEN
    RETURN NULL;
  END IF;

  -- Check urgency threshold
  IF FOUND THEN
    -- Map urgency to rank
    v_urgency_rank := CASE p_urgency
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;
    v_threshold_rank := CASE v_pref.urgency_threshold
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;

    IF v_urgency_rank < v_threshold_rank THEN
      RETURN NULL; -- below user's threshold, don't send
    END IF;
  END IF;

  -- Smart batching: check if a recent notification with same batch_key exists (within 60s)
  IF p_batch_key IS NOT NULL THEN
    SELECT id, batch_count INTO v_existing_batch, v_batch_count
    FROM notifications
    WHERE batch_key = p_batch_key
      AND recipient_id = p_recipient_id
      AND created_at > NOW() - INTERVAL '60 seconds'
      AND is_read = FALSE
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Update existing notification's count and body
      UPDATE notifications
      SET
        batch_count = v_batch_count + 1,
        body = p_body,  -- most recent body
        title = CASE
          WHEN v_batch_count + 1 >= 3
          THEN regexp_replace(p_title, '^\d+ ', '') -- strip leading count
               -- Caller is responsible for title like "3 new updates in Finance"
          ELSE p_title
        END,
        updated_at = NOW()
      WHERE id = v_existing_batch
      RETURNING id INTO v_notification_id;

      RETURN v_notification_id;
    END IF;
  END IF;

  -- Insert new notification
  INSERT INTO notifications (
    tenant_id, event_id, recipient_id, recipient_type,
    module, urgency, title, body, action_url, batch_key
  )
  VALUES (
    p_tenant_id, p_event_id, p_recipient_id, p_recipient_type,
    p_module, p_urgency, p_title, p_body, p_action_url, p_batch_key
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ─── Function: mark_notifications_read ───────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_recipient_id UUID,
  p_ids          UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND id = ANY(p_ids)
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: mark_all_notifications_read ────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_recipient_id UUID,
  p_tenant_id    UUID
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND tenant_id = p_tenant_id
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: get_unread_count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_unread_count(
  p_recipient_id UUID
)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT
  FROM notifications
  WHERE recipient_id = p_recipient_id
    AND is_read = FALSE;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Each recipient can only see and update their own notifications
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read" ON notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE
  USING (recipient_id = auth.uid());

-- Service role (used by backend) can insert
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT
  WITH CHECK (TRUE);  -- enforced at application layer

-- Super admins can read all
DROP POLICY IF EXISTS "notifications_super_admin_all" ON notifications;
CREATE POLICY "notifications_super_admin_all" ON notifications
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- Preferences: own rows only
DROP POLICY IF EXISTS "notif_prefs_own" ON notification_preferences;
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ─── Enable Supabase Realtime ─────────────────────────────────────────────────

-- Add notifications to the realtime publication so clients can subscribe
-- to filtered channels: realtime:notifications:recipient_id=<uuid>
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE notifications IS
  'Cross-portal notification centre. Recipients can be team members, guests, clients, or vendors. '
  'Supabase Realtime streams new rows filtered by recipient_id.';

COMMENT ON TABLE notification_preferences IS
  'Per-user per-module notification preferences. Controls in-app, email, WhatsApp delivery and urgency threshold.';

COMMENT ON FUNCTION create_notification IS
  'Insert a notification respecting user preferences and smart batching. '
  'Returns the notification id, or NULL if suppressed by preferences.';
