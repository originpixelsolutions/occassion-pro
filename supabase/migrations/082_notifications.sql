-- ============================================================================
-- Migration 082: Notification Templates, Preferences & Delivery Log
-- OccasionPro — Multi-channel notification infrastructure
-- ============================================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'in_app', 'email', 'sms', 'whatsapp', 'push'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'queued', 'sent', 'delivered', 'failed', 'bounced', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_recipient_type AS ENUM (
    'team', 'guest', 'client', 'vendor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notification_templates ───────────────────────────────────────────────────
-- System templates (tenant_id NULL) + tenant overrides (tenant_id SET)

CREATE TABLE IF NOT EXISTS notification_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system template
  template_key      TEXT NOT NULL,
  channel           notification_channel NOT NULL,
  event_trigger     TEXT NOT NULL,                     -- e.g. 'guest.rsvp_confirmed'
  subject_template  TEXT,                              -- for email channel
  body_template     TEXT NOT NULL,                     -- Handlebars template string
  variables         JSONB DEFAULT '[]',                -- [{name, description, required}]
  is_system         BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NULL-safe unique: one system template + one override per tenant per template_key+channel
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_templates_system
  ON notification_templates (template_key, channel)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_templates_tenant
  ON notification_templates (template_key, channel, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_templates_key_channel
  ON notification_templates (template_key, channel);
CREATE INDEX IF NOT EXISTS idx_notif_templates_tenant
  ON notification_templates (tenant_id) WHERE tenant_id IS NOT NULL;

-- ─── notification_preferences ─────────────────────────────────────────────────
-- Per-user, per-tenant channel toggle matrix + quiet hours

CREATE TABLE IF NOT EXISTS notification_channel_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- JSONB map of category → {in_app, email, sms, whatsapp, push}
  -- e.g. {"events": {"in_app": true, "email": true, "sms": false, "whatsapp": true, "push": true}}
  channel_preferences JSONB NOT NULL DEFAULT '{
    "events":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": true,  "push": true},
    "guests":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true},
    "runsheet":  {"in_app": true,  "email": false, "sms": false, "whatsapp": false, "push": true},
    "payments":  {"in_app": true,  "email": true,  "sms": false, "whatsapp": true,  "push": false},
    "vendors":   {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": false},
    "alerts":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true},
    "clients":   {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": false},
    "team":      {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true}
  }',
  quiet_hours_start   TIME,           -- e.g. '22:00'
  quiet_hours_end     TIME,           -- e.g. '08:00'
  timezone            TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_tenant
  ON notification_channel_preferences (user_id, tenant_id);

-- ─── notification_log ─────────────────────────────────────────────────────────
-- Immutable delivery log for all outbound notifications

CREATE TABLE IF NOT EXISTS notification_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_type      notification_recipient_type NOT NULL,
  recipient_id        UUID NOT NULL,
  channel             notification_channel NOT NULL,
  template_key        TEXT NOT NULL,
  event_id            UUID,           -- nullable, links notification to an event
  status              notification_delivery_status NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,           -- e.g. Resend email ID, Fast2SMS message ID
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  metadata            JSONB DEFAULT '{}',  -- rendered subject, body snippet, variables used
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_tenant      ON notification_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_recipient   ON notification_log (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_status      ON notification_log (status);
CREATE INDEX IF NOT EXISTS idx_notif_log_event       ON notification_log (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_log_template    ON notification_log (template_key);

-- Enable Supabase Realtime on notification_log (for super admin monitoring)
ALTER TABLE notification_log REPLICA IDENTITY FULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE notification_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log                 ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all; tenant templates to own tenant
CREATE POLICY "notification_templates_select" ON notification_templates
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = (
    SELECT tenant_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- Preferences: own row only
CREATE POLICY "notification_prefs_own" ON notification_channel_preferences
  FOR ALL USING (user_id = auth.uid());

-- Log: own tenant reads
CREATE POLICY "notification_log_tenant" ON notification_log
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- ─── Helper function: check quiet hours ──────────────────────────────────────

CREATE OR REPLACE FUNCTION is_in_quiet_hours(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_start TIME;
  v_end   TIME;
  v_tz    TEXT;
  v_now   TIME;
BEGIN
  SELECT quiet_hours_start, quiet_hours_end, timezone
    INTO v_start, v_end, v_tz
    FROM notification_channel_preferences
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN false;
  END IF;

  v_now := (now() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::TIME;

  -- Handle overnight quiet hours (e.g. 22:00 → 08:00)
  IF v_start > v_end THEN
    RETURN v_now >= v_start OR v_now <= v_end;
  ELSE
    RETURN v_now >= v_start AND v_now <= v_end;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Seed: 30 System Notification Templates ──────────────────────────────────

INSERT INTO notification_templates (template_key, channel, event_trigger, subject_template, body_template, variables, is_system) VALUES

-- ── Guest events ──────────────────────────────────────────────────────────────

('guest_rsvp_confirmed', 'email', 'guest.rsvp_confirmed',
 'Your RSVP is confirmed — {{event_name}}',
 '<p>Hi {{guest_name}},</p><p>Great news! Your RSVP for <strong>{{event_name}}</strong> on {{event_date}} has been confirmed.</p><p>Venue: {{venue_name}}</p>{{#if qr_link}}<p>Your entry QR code: <a href="{{qr_link}}">View QR Code</a></p>{{/if}}<p>We look forward to seeing you!</p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_rsvp_confirmed', 'whatsapp', 'guest.rsvp_confirmed',
 NULL,
 '✅ *RSVP Confirmed!*\n\nHi {{guest_name}}, your attendance at *{{event_name}}* on {{event_date}} is confirmed.\n\n📍 Venue: {{venue_name}}\n{{#if qr_link}}🎟️ Your QR code: {{qr_link}}{{/if}}\n\nSee you there! 🎉',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_checkin_welcome', 'whatsapp', 'guest.checked_in',
 NULL,
 '👋 *Welcome, {{guest_name}}!*\n\nYou''ve successfully checked in to *{{event_name}}*.\n\n{{#if digital_badge_link}}🏷️ Your digital badge: {{digital_badge_link}}{{/if}}\n{{#if table_number}}🪑 Your table: {{table_number}}{{/if}}\n\nEnjoy the event! ✨',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"digital_badge_link","required":false},{"name":"table_number","required":false}]',
 true),

('guest_event_reminder_24h', 'email', 'event.reminder_24h',
 '📅 Reminder: {{event_name}} is tomorrow!',
 '<p>Hi {{guest_name}},</p><p>Just a reminder that <strong>{{event_name}}</strong> is <strong>tomorrow, {{event_date}}</strong>.</p><p>📍 <strong>Venue:</strong> {{venue_name}}, {{venue_address}}</p><p>🕐 <strong>Time:</strong> {{event_time}}</p>{{#if qr_link}}<p>🎟️ <strong>Your entry QR:</strong> <a href="{{qr_link}}">View Here</a></p>{{/if}}<p>We''re excited to see you!</p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"venue_address","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_event_reminder_24h', 'sms', 'event.reminder_24h',
 NULL,
 'Hi {{guest_name}}, reminder: {{event_name}} is tomorrow at {{event_time}}. Venue: {{venue_name}}. {{#if qr_link}}QR: {{qr_link}}{{/if}}',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"qr_link","required":false}]',
 true),

('guest_event_reminder_24h', 'whatsapp', 'event.reminder_24h',
 NULL,
 '⏰ *Event Reminder*\n\nHi {{guest_name}}, *{{event_name}}* is tomorrow!\n\n🗓️ Date: {{event_date}}\n🕐 Time: {{event_time}}\n📍 Venue: {{venue_name}}\n{{#if qr_link}}🎟️ Your QR: {{qr_link}}{{/if}}\n\nSee you there! 👋',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"qr_link","required":false}]',
 true),

('guest_invitation_sent', 'email', 'guest.invitation_sent',
 'You''re invited to {{event_name}}!',
 '<p>Hi {{guest_name}},</p><p>You''ve been invited to <strong>{{event_name}}</strong>.</p><p>🗓️ Date: {{event_date}}<br>📍 Venue: {{venue_name}}</p><p><a href="{{rsvp_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">RSVP Now</a></p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"rsvp_link","required":true}]',
 true),

('guest_invitation_sent', 'whatsapp', 'guest.invitation_sent',
 NULL,
 '🎉 *You''re Invited!*\n\nHi {{guest_name}}, you''ve been invited to *{{event_name}}*.\n\n🗓️ {{event_date}}\n📍 {{venue_name}}\n\n👉 RSVP here: {{rsvp_link}}',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"rsvp_link","required":true}]',
 true),

-- ── Team events ───────────────────────────────────────────────────────────────

('team_invite', 'email', 'team.member_invited',
 'You''ve been invited to join {{workspace_name}} on OccasionPro',
 '<p>Hi {{invitee_name}},</p><p><strong>{{inviter_name}}</strong> has invited you to join <strong>{{workspace_name}}</strong> on OccasionPro as <strong>{{role}}</strong>.</p><p><a href="{{invite_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Accept Invitation</a></p><p>This link expires in 7 days.</p>',
 '[{"name":"invitee_name","required":true},{"name":"inviter_name","required":true},{"name":"workspace_name","required":true},{"name":"role","required":true},{"name":"invite_link","required":true}]',
 true),

('team_event_assigned', 'email', 'team.event_assigned',
 'You''ve been assigned to {{event_name}}',
 '<p>Hi {{member_name}},</p><p>You''ve been assigned to <strong>{{event_name}}</strong> on {{event_date}} as <strong>{{role}}</strong>.</p><p><a href="{{event_url}}">View Event</a></p>',
 '[{"name":"member_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"role","required":true},{"name":"event_url","required":true}]',
 true),

('team_event_assigned', 'in_app', 'team.event_assigned',
 NULL,
 'You''ve been assigned to {{event_name}} as {{role}}.',
 '[{"name":"event_name","required":true},{"name":"role","required":true}]',
 true),

('runsheet_item_assigned', 'in_app', 'runsheet.item_assigned',
 NULL,
 '📋 Runsheet item assigned: "{{item_title}}" at {{start_time}} on {{event_name}}.',
 '[{"name":"item_title","required":true},{"name":"start_time","required":true},{"name":"event_name","required":true}]',
 true),

('runsheet_item_assigned', 'push', 'runsheet.item_assigned',
 'New runsheet assignment',
 '📋 "{{item_title}}" at {{start_time}} — {{event_name}}',
 '[{"name":"item_title","required":true},{"name":"start_time","required":true},{"name":"event_name","required":true}]',
 true),

('alert_critical', 'in_app', 'intelligence.alert_critical',
 NULL,
 '🚨 {{alert_title}}: {{alert_message}}',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true},{"name":"event_name","required":false}]',
 true),

('alert_critical', 'email', 'intelligence.alert_critical',
 '🚨 Critical Alert — {{event_name}}: {{alert_title}}',
 '<p><strong>⚠️ Critical Alert</strong></p><p><strong>Event:</strong> {{event_name}}<br><strong>Alert:</strong> {{alert_title}}</p><p>{{alert_message}}</p><p><a href="{{event_url}}">View Event Dashboard</a></p>',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true},{"name":"event_name","required":true},{"name":"event_url","required":true}]',
 true),

('alert_critical', 'push', 'intelligence.alert_critical',
 '🚨 Critical Alert',
 '{{alert_title}}: {{alert_message}}',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true}]',
 true),

-- ── Vendor events ─────────────────────────────────────────────────────────────

('vendor_event_assigned', 'email', 'vendor.event_assigned',
 'New event assignment: {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>You have been assigned to <strong>{{event_name}}</strong> on {{event_date}} at {{venue_name}}.</p><p>Category: {{vendor_category}}</p><p><a href="{{vendor_portal_url}}">View in Vendor Portal</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"vendor_category","required":false},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_payment_done', 'email', 'vendor.payment_processed',
 'Payment processed: ₹{{amount}} for {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>A payment of <strong>₹{{amount}}</strong> has been processed for <strong>{{event_name}}</strong>.</p><p>Reference: {{payment_reference}}<br>Date: {{payment_date}}</p><p><a href="{{vendor_portal_url}}">View in Vendor Portal</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"amount","required":true},{"name":"event_name","required":true},{"name":"payment_reference","required":false},{"name":"payment_date","required":true},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_settlement_reminder', 'email', 'vendor.settlement_reminder',
 'Pending settlement: {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>This is a reminder that your settlement for <strong>{{event_name}}</strong> is pending.</p><p>Outstanding amount: <strong>₹{{outstanding_amount}}</strong><br>Due date: {{due_date}}</p><p><a href="{{vendor_portal_url}}">View Details</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"event_name","required":true},{"name":"outstanding_amount","required":true},{"name":"due_date","required":true},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_settlement_reminder', 'in_app', 'vendor.settlement_reminder',
 NULL,
 '💰 Settlement pending for {{event_name}}: ₹{{outstanding_amount}} due {{due_date}}.',
 '[{"name":"event_name","required":true},{"name":"outstanding_amount","required":true},{"name":"due_date","required":true}]',
 true),

-- ── Client events ─────────────────────────────────────────────────────────────

('client_portal_access', 'email', 'client.portal_access_granted',
 'Your OccasionPro client portal is ready — {{event_name}}',
 '<p>Hi {{client_name}},</p><p>Your event planning portal for <strong>{{event_name}}</strong> is now live!</p><p>You can view proposals, approve items, share feedback, and track event progress.</p><p><a href="{{magic_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Access Your Portal</a></p><p>This link expires in 24 hours. You can request a new one at any time.</p>',
 '[{"name":"client_name","required":true},{"name":"event_name","required":true},{"name":"magic_link","required":true}]',
 true),

('client_file_shared', 'email', 'client.file_shared',
 'New document shared: {{file_name}} — {{event_name}}',
 '<p>Hi {{client_name}},</p><p>A new document <strong>{{file_name}}</strong> has been shared with you for <strong>{{event_name}}</strong>.</p><p><a href="{{portal_url}}">View in Your Portal</a></p>',
 '[{"name":"client_name","required":true},{"name":"file_name","required":true},{"name":"event_name","required":true},{"name":"portal_url","required":true}]',
 true),

('client_file_shared', 'in_app', 'client.file_shared',
 NULL,
 '📄 New document shared: "{{file_name}}" for {{event_name}}.',
 '[{"name":"file_name","required":true},{"name":"event_name","required":true}]',
 true),

-- ── Payment events ────────────────────────────────────────────────────────────

('payment_confirmed', 'email', 'payment.confirmed',
 '✅ Payment confirmed — ₹{{amount}}',
 '<p>Hi {{buyer_name}},</p><p>Your payment of <strong>₹{{amount}}</strong> has been confirmed.</p><p>Reference: {{payment_reference}}<br>Event: {{event_name}}<br>Date: {{payment_date}}</p><p>Thank you!</p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"payment_reference","required":true},{"name":"event_name","required":false},{"name":"payment_date","required":true}]',
 true),

('payment_confirmed', 'whatsapp', 'payment.confirmed',
 NULL,
 '✅ *Payment Confirmed!*\n\nHi {{buyer_name}}, your payment of *₹{{amount}}* has been received.\n\nRef: {{payment_reference}}\n📅 {{payment_date}}\n\nThank you! 🙏',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"payment_reference","required":true},{"name":"payment_date","required":true}]',
 true),

('refund_processed', 'email', 'payment.refund_processed',
 'Refund processed — ₹{{amount}}',
 '<p>Hi {{buyer_name}},</p><p>A refund of <strong>₹{{amount}}</strong> has been processed to your original payment method.</p><p>Reference: {{refund_reference}}<br>Expected within: 5–7 business days</p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"refund_reference","required":true}]',
 true),

('payment_failed', 'email', 'payment.failed',
 'Payment failed — action required',
 '<p>Hi {{buyer_name}},</p><p>Your payment of <strong>₹{{amount}}</strong> could not be processed.</p><p>Reason: {{failure_reason}}</p><p>Please try again or use a different payment method.</p><p><a href="{{retry_url}}">Retry Payment</a></p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"failure_reason","required":false},{"name":"retry_url","required":true}]',
 true)

ON CONFLICT DO NOTHING;

-- ─── updated_at trigger on templates ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notification_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_notification_template_updated_at();
