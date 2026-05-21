-- ============================================================
-- Migration 091: WhatsApp Broadcast Campaigns
-- ============================================================
-- Tables:
--   whatsapp_broadcasts          — campaign header
--   whatsapp_broadcast_recipients — per-recipient delivery status
--   whatsapp_opt_outs            — global opt-out registry
--   whatsapp_inbox               — two-way message inbox
-- ============================================================

-- ── Opt-out registry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_opt_outs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT DEFAULT 'user_reply',        -- 'user_reply' | 'manual' | 'staff'
  opted_in_at  TIMESTAMPTZ,                       -- set when user re-opts-in
  notes        TEXT,
  UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_wa_opt_outs_tenant_phone ON whatsapp_opt_outs(tenant_id, phone);

-- ── Broadcast campaigns ──────────────────────────────────────────────────────

CREATE TYPE wa_broadcast_status AS ENUM (
  'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed'
);

CREATE TYPE wa_message_type AS ENUM (
  'template', 'free_form'
);

CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Campaign identity
  name            TEXT NOT NULL,
  description     TEXT,

  -- Message content
  message_type    wa_message_type NOT NULL DEFAULT 'free_form',
  template_name   TEXT,                           -- Meta template ID (for 'template' type)
  template_params JSONB DEFAULT '[]',             -- array of parameter values
  body_text       TEXT,                           -- free-form message body

  -- Audience
  audience_filter JSONB DEFAULT '{}',
  -- Examples:
  --   {"all": true}
  --   {"rsvp_status": ["confirmed", "maybe"]}
  --   {"dietary": ["vegetarian", "vegan"]}
  --   {"tags": ["vip", "family"]}
  --   {"guest_ids": ["uuid1", "uuid2"]}

  -- Scheduling
  scheduled_at    TIMESTAMPTZ,                    -- null = send immediately
  sent_at         TIMESTAMPTZ,

  -- Status
  status          wa_broadcast_status NOT NULL DEFAULT 'draft',
  error_message   TEXT,

  -- Stats (denormalised for fast dashboard reads)
  total_count     INT NOT NULL DEFAULT 0,
  sent_count      INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  read_count      INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  replied_count   INT NOT NULL DEFAULT 0,
  opted_out_count INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_broadcasts_tenant ON whatsapp_broadcasts(tenant_id);
CREATE INDEX idx_wa_broadcasts_event  ON whatsapp_broadcasts(event_id);
CREATE INDEX idx_wa_broadcasts_status ON whatsapp_broadcasts(status);
CREATE INDEX idx_wa_broadcasts_sched  ON whatsapp_broadcasts(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ── Broadcast recipients ─────────────────────────────────────────────────────

CREATE TYPE wa_delivery_status AS ENUM (
  'pending', 'sent', 'delivered', 'read', 'failed', 'opted_out', 'skipped'
);

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id    UUID NOT NULL REFERENCES whatsapp_broadcasts(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Recipient
  guest_id        UUID REFERENCES guest_details(id) ON DELETE SET NULL,
  phone           TEXT NOT NULL,
  name            TEXT,

  -- Message tracking
  wa_message_id   TEXT,                           -- Meta message ID from send response
  status          wa_delivery_status NOT NULL DEFAULT 'pending',
  error_code      TEXT,
  error_message   TEXT,

  -- Timestamps
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (broadcast_id, phone)
);

CREATE INDEX idx_wa_recipients_broadcast ON whatsapp_broadcast_recipients(broadcast_id);
CREATE INDEX idx_wa_recipients_status    ON whatsapp_broadcast_recipients(status);
CREATE INDEX idx_wa_recipients_wa_msg    ON whatsapp_broadcast_recipients(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_wa_recipients_guest     ON whatsapp_broadcast_recipients(guest_id) WHERE guest_id IS NOT NULL;

-- ── Two-way inbox ────────────────────────────────────────────────────────────

CREATE TYPE wa_inbox_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  broadcast_id    UUID REFERENCES whatsapp_broadcasts(id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES guest_details(id) ON DELETE SET NULL,

  -- Conversation thread key
  phone           TEXT NOT NULL,
  contact_name    TEXT,
  wa_message_id   TEXT,                           -- Meta message ID

  -- Message
  direction       wa_inbox_direction NOT NULL,
  body            TEXT NOT NULL,
  media_url       TEXT,
  media_type      TEXT,                           -- 'image' | 'document' | 'audio' | 'video'

  -- State
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  staff_reply     TEXT,                           -- staff reply drafted but not sent
  replied_by      UUID REFERENCES profiles(id),
  replied_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_inbox_tenant       ON whatsapp_inbox(tenant_id);
CREATE INDEX idx_wa_inbox_phone        ON whatsapp_inbox(tenant_id, phone);
CREATE INDEX idx_wa_inbox_broadcast    ON whatsapp_inbox(broadcast_id);
CREATE INDEX idx_wa_inbox_unread       ON whatsapp_inbox(tenant_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_wa_inbox_created      ON whatsapp_inbox(created_at DESC);

-- ── Triggers: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_whatsapp_broadcast_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_wa_broadcast_updated_at
  BEFORE UPDATE ON whatsapp_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_broadcast_updated_at();

CREATE TRIGGER trg_wa_recipient_updated_at
  BEFORE UPDATE ON whatsapp_broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_broadcast_updated_at();

-- ── Function: update broadcast stats from recipient changes ──────────────────

CREATE OR REPLACE FUNCTION recalculate_broadcast_stats(p_broadcast_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE whatsapp_broadcasts
  SET
    sent_count      = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND status IN ('sent','delivered','read')),
    delivered_count = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND status IN ('delivered','read')),
    read_count      = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND status = 'read'),
    failed_count    = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND status = 'failed'),
    opted_out_count = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND status = 'opted_out'),
    replied_count   = (SELECT COUNT(*) FROM whatsapp_broadcast_recipients WHERE broadcast_id = p_broadcast_id AND replied_at IS NOT NULL),
    updated_at      = now()
  WHERE id = p_broadcast_id;
END; $$;

-- Trigger to auto-refresh stats on recipient status changes
CREATE OR REPLACE FUNCTION trigger_refresh_broadcast_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalculate_broadcast_stats(COALESCE(NEW.broadcast_id, OLD.broadcast_id));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_wa_recipient_stats
  AFTER INSERT OR UPDATE OF status, replied_at ON whatsapp_broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_broadcast_stats();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE whatsapp_broadcasts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcast_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_opt_outs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbox                   ENABLE ROW LEVEL SECURITY;

-- Broadcasts — tenant-scoped
CREATE POLICY wa_broadcasts_tenant ON whatsapp_broadcasts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY wa_recipients_tenant ON whatsapp_broadcast_recipients
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY wa_opt_outs_tenant ON whatsapp_opt_outs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY wa_inbox_tenant ON whatsapp_inbox
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Enable realtime for live delivery tracking
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_broadcast_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_inbox;
