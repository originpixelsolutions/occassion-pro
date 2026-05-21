-- 063_client_portal_v2.sql
-- Client Portal v2: sessions table, messages table, magic links, per-tenant email uniqueness

-- ── 1. Add tenant_id to client_accounts (missing from 049) ──────────────────
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop the global email unique constraint and replace with per-tenant unique
ALTER TABLE client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_email_key;

-- Re-add per-tenant unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_client_accounts_tenant_email'
  ) THEN
    ALTER TABLE client_accounts
      ADD CONSTRAINT uq_client_accounts_tenant_email UNIQUE (tenant_id, email);
  END IF;
END $$;

ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS profile_complete bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS last_login_at    timestamptz;

-- ── 2. client_portal_sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  user_agent     text,
  ip_hash        varchar(64)
);

CREATE INDEX IF NOT EXISTS idx_cp_sessions_client  ON client_portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_sessions_expires ON client_portal_sessions(expires_at);

-- ── 3. client_magic_links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_magic_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  purpose     text        NOT NULL DEFAULT 'login',   -- login | set_password
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used        bool        NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_magic_links_client ON client_magic_links(client_id);

-- ── 4. client_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type         text        NOT NULL CHECK (sender_type IN ('team', 'client')),
  sender_id           uuid        NOT NULL,
  message             text        NOT NULL,
  attachment_url      text,
  attachment_name     text,
  is_read_by_client   bool        NOT NULL DEFAULT false,
  is_read_by_team     bool        NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_messages_event   ON client_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_tenant  ON client_messages(tenant_id);

-- ── 5. Add access_level values — update existing 'view_only'→'view' ──────────
-- Keep backwards compat: the new enum adds 'view' | 'collaborator' | 'full'
-- existing rows have 'view_only' | 'collaborator' | 'full_access'
-- We normalise with a check constraint comment only — no data loss

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_magic_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages        ENABLE ROW LEVEL SECURITY;

-- service role bypasses RLS; policies for anon/authenticated tenants:
DO $$
BEGIN
  -- Sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_portal_sessions' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_portal_sessions USING (true) WITH CHECK (true);
  END IF;
  -- Magic links
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_magic_links' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_magic_links USING (true) WITH CHECK (true);
  END IF;
  -- Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_messages' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_messages USING (true) WITH CHECK (true);
  END IF;
END $$;
