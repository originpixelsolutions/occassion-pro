-- ============================================================
-- Migration 036: Communication & Messaging
-- event_messages, message_threads, broadcast_messages
-- ============================================================

-- ── Message threads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  thread_type   TEXT NOT NULL DEFAULT 'internal'
                CHECK (thread_type IN ('internal','client','vendor','broadcast')),
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','resolved','archived')),
  participants  UUID[] NOT NULL DEFAULT '{}',   -- profile_ids
  last_message_at TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant   ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_event    ON message_threads(event_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_type     ON message_threads(thread_type);

-- ── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES profiles(id),
  sender_name   TEXT,                          -- fallback for external senders
  message       TEXT NOT NULL,
  message_type  TEXT NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text','system','file')),
  attachments   JSONB DEFAULT '[]',            -- [{name, url, size, mime_type}]
  is_read_by    UUID[] NOT NULL DEFAULT '{}',  -- profile_ids who have read
  reply_to_id   UUID REFERENCES event_messages(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_thread  ON event_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_tenant  ON event_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_event   ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_created ON event_messages(created_at DESC);

-- ── Broadcast messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'all_team'
                  CHECK (audience IN ('all_team','all_guests','vendors','specific_roles','specific_guests')),
  audience_filter JSONB DEFAULT '{}',          -- {role_ids: [], guest_tags: [], etc.}
  channels        TEXT[] NOT NULL DEFAULT ARRAY['in_app'],  -- in_app, email, sms, whatsapp
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sent','failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_count      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_tenant ON broadcast_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_event  ON broadcast_messages(event_id);

-- ── Announcement pins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON event_announcements(event_id);

-- ── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_message_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_thread_last_message ON event_messages;
CREATE TRIGGER trg_update_thread_last_message
  AFTER INSERT ON event_messages
  FOR EACH ROW EXECUTE FUNCTION update_message_thread_last_message();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE message_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_message_threads"     ON message_threads     USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_messages"      ON event_messages      USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_broadcast_messages"  ON broadcast_messages  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_announcements" ON event_announcements USING (tenant_id = current_setting('app.tenant_id')::uuid);
