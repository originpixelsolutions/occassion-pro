-- ─────────────────────────────────────────────────────────────
-- Migration 095: SMS Broadcast Module
-- Supports: bulk SMS campaigns, segmented sends, delivery tracking,
--           replies inbox, opt-out management, provider config
-- Providers: Twilio, MSG91, Exotel (selectable per tenant)
-- ─────────────────────────────────────────────────────────────

-- ── SMS Provider config per tenant ───────────────────────────
CREATE TABLE IF NOT EXISTS sms_provider_configs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  provider   text NOT NULL DEFAULT 'msg91'
             CHECK (provider IN ('twilio','msg91','exotel','custom')),
  is_active  boolean NOT NULL DEFAULT true,

  -- Twilio
  twilio_account_sid  text,
  twilio_auth_token   text,
  twilio_from_number  text,

  -- MSG91
  msg91_auth_key      text,
  msg91_sender_id     text,   -- 6-char DLT registered sender
  msg91_template_id   text,   -- DLT template ID (India)

  -- Exotel
  exotel_sid          text,
  exotel_token        text,
  exotel_from         text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Opt-out list (global per tenant) ─────────────────────────
CREATE TABLE IF NOT EXISTS sms_optouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone      text NOT NULL,
  opted_out_at  timestamptz NOT NULL DEFAULT now(),
  reason        text,
  UNIQUE (tenant_id, phone)
);

-- ── SMS Broadcast campaigns ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_broadcasts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  name        text NOT NULL,
  message     text NOT NULL,               -- up to 1600 chars (multi-part)
  unicode     boolean NOT NULL DEFAULT false,

  -- Segmentation filters (JSON criteria applied at send-time)
  segment_filters  jsonb NOT NULL DEFAULT '{}'::jsonb,
  /*
    Example:
    {
      "rsvp_status":          ["confirmed","pending"],
      "accommodation_type":   ["hotel","guesthouse"],
      "dietary_requirement":  ["vegetarian"],
      "guest_category":       ["VIP"],
      "custom_phone_list":    ["+919876543210"]   -- override: explicit list
    }
  */

  -- Schedule
  scheduled_at   timestamptz,       -- null = send immediately on publish
  sent_at        timestamptz,

  -- Counts (updated as messages are sent)
  total_recipients  int NOT NULL DEFAULT 0,
  sent_count        int NOT NULL DEFAULT 0,
  delivered_count   int NOT NULL DEFAULT 0,
  failed_count      int NOT NULL DEFAULT 0,
  reply_count       int NOT NULL DEFAULT 0,
  optout_count      int NOT NULL DEFAULT 0,

  status  text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Individual SMS messages (one row per recipient per campaign) ─
CREATE TABLE IF NOT EXISTS sms_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id   uuid NOT NULL REFERENCES sms_broadcasts(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id       uuid REFERENCES guests(id) ON DELETE SET NULL,

  to_phone       text NOT NULL,
  to_name        text,

  -- Provider tracking
  provider_message_id  text,   -- Twilio SID / MSG91 request_id
  segments_count       int NOT NULL DEFAULT 1,

  status   text NOT NULL DEFAULT 'queued'
           CHECK (status IN ('queued','sent','delivered','failed','undelivered','opted_out')),
  error    text,

  sent_at       timestamptz,
  delivered_at  timestamptz,
  failed_at     timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Inbound replies ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  broadcast_id uuid REFERENCES sms_broadcasts(id) ON DELETE SET NULL,
  message_id   uuid REFERENCES sms_messages(id) ON DELETE SET NULL,
  guest_id     uuid REFERENCES guests(id) ON DELETE SET NULL,

  from_phone   text NOT NULL,
  from_name    text,
  body         text NOT NULL,

  is_read      boolean NOT NULL DEFAULT false,
  is_optout    boolean NOT NULL DEFAULT false,   -- auto-detected STOP/UNSUB

  provider_message_id  text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sms_broadcasts_tenant       ON sms_broadcasts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_broadcasts_event        ON sms_broadcasts(event_id);
CREATE INDEX IF NOT EXISTS idx_sms_broadcasts_status       ON sms_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_broadcast      ON sms_messages(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_guest          ON sms_messages(guest_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_id    ON sms_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_replies_tenant          ON sms_replies(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_replies_broadcast       ON sms_replies(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_sms_replies_unread          ON sms_replies(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_sms_optouts_phone           ON sms_optouts(tenant_id, phone);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE sms_provider_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_optouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_broadcasts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_replies           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_sms_provider_configs" ON sms_provider_configs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_sms_optouts" ON sms_optouts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_sms_broadcasts" ON sms_broadcasts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_sms_messages" ON sms_messages
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_sms_replies" ON sms_replies
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
