-- ============================================================
-- Migration: 081_security.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 081: Security Infrastructure
--
-- Two tables:
--   • auth_attempts      — brute-force protection (BruteForceService)
--   • security_audit_log — immutable security event log (SecurityAuditService)
--
-- Privacy: IP addresses, identifiers, and user agents are stored
-- as SHA-256 hashes only (hashed before insert in BruteForceService
-- and SecurityAuditService via FieldEncryptionService.hashForStorage).
--
-- Referenced by:
--   apps/api/src/common/security/brute-force.service.ts
--   apps/api/src/common/security/security-audit.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE attempt_type_enum AS ENUM (
    'password','otp','magic_link','api_key',
    'vendor_login','client_login','guest_login'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── auth_attempts ──────────────────────────────────────────────────────────────
-- Tracks authentication attempts for brute-force detection.
-- All sensitive values (IP, identifier, user_agent) are SHA-256 hashed.
-- Rows older than 24 hours are irrelevant for lockout checks and can be pruned.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,              -- nullable: pre-auth attempts may lack tenant context
  ip_hash          text               NOT NULL,
  identifier_hash  text               NOT NULL,  -- hash of email / phone / token
  attempt_type     text               NOT NULL,  -- matches attempt_type_enum values (stored as text for flexibility)
  success          boolean            NOT NULL DEFAULT false,
  user_agent_hash  text,
  created_at       timestamptz        NOT NULL DEFAULT now()
);

-- Fast lockout check: recent failures for a given identifier+type
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_type
  ON auth_attempts(identifier_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Fast lockout check: recent failures for a given IP
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip
  ON auth_attempts(ip_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Tenant-scoped query support
CREATE INDEX IF NOT EXISTS idx_auth_attempts_tenant
  ON auth_attempts(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── security_audit_log ─────────────────────────────────────────────────────────
-- Append-only security event log. No UPDATE or DELETE policies for tenant users.
-- Written by SecurityAuditService fire-and-forget from throughout the API.
CREATE TABLE IF NOT EXISTS security_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text        NOT NULL,   -- matches SecurityAction union type
  tenant_id      uuid,
  user_id        uuid,
  resource_type  text,
  resource_id    text,
  ip_hash        text,
  user_agent_hash text,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  success        boolean     NOT NULL DEFAULT true,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Super-admin dashboard: list events by tenant (recent first)
CREATE INDEX IF NOT EXISTS idx_security_audit_log_tenant
  ON security_audit_log(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action
  ON security_audit_log(action, created_at DESC);

-- Filter failures only
CREATE INDEX IF NOT EXISTS idx_security_audit_log_failures
  ON security_audit_log(tenant_id, action, created_at DESC)
  WHERE success = false;

-- User-scoped audit trail
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user
  ON security_audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────────

-- auth_attempts: service role only (written/read exclusively by BruteForceService)
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_attempts_service"
  ON auth_attempts FOR ALL
  USING (auth.role() = 'service_role');

-- security_audit_log: read-only for tenant members (append-only semantics)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_audit_log_tenant_read"
  ON security_audit_log FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for tenant users — only service role may write
CREATE POLICY "security_audit_log_service"
  ON security_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- ── Pruning helper (called by a scheduled cron in super-admin automation) ──────
-- Removes auth_attempts older than 24 hours (they cannot affect lockout windows)
-- and audit log entries older than 2 years (regulatory retention = 1 year + buffer).
CREATE OR REPLACE FUNCTION prune_security_tables()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM auth_attempts
  WHERE created_at < now() - interval '24 hours';

  DELETE FROM security_audit_log
  WHERE created_at < now() - interval '2 years';
$$;

-- ============================================================
-- Migration: 082_notifications.sql
-- ============================================================
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

-- ============================================================
-- Migration: 083_dpdp.sql
-- ============================================================
-- ============================================================
-- Migration 083: DPDP Compliance
-- India's Digital Personal Data Protection Act 2023
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE subject_type_enum AS ENUM ('guest', 'team_member', 'client', 'vendor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_type_enum AS ENUM (
    'data_processing',
    'marketing_comms',
    'photo_sharing',
    'third_party_sharing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_request_type_enum AS ENUM ('access', 'correction', 'erasure', 'portability');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_request_status_enum AS ENUM ('pending', 'processing', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── consent_records ──────────────────────────────────────────────────────────
-- Records every explicit consent event (and withdrawal).
-- ip_hash + user_agent_hash are SHA-256 digests — never store raw PII.

CREATE TABLE IF NOT EXISTS consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  subject_type     subject_type_enum NOT NULL,
  subject_id       UUID,               -- NULL for unauthenticated subjects
  subject_email    TEXT NOT NULL,
  consent_type     consent_type_enum NOT NULL,
  consent_given    BOOLEAN NOT NULL DEFAULT TRUE,
  consent_text     TEXT NOT NULL,       -- exact text shown to the user
  ip_hash          TEXT,               -- SHA-256 of originating IP
  user_agent_hash  TEXT,               -- SHA-256 of User-Agent string
  given_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at     TIMESTAMPTZ,
  version          TEXT NOT NULL DEFAULT '1.0',

  CONSTRAINT consent_records_email_not_empty CHECK (subject_email <> '')
);

-- ─── data_requests ────────────────────────────────────────────────────────────
-- Tracks subject rights requests (access, erasure, correction, portability).

CREATE TABLE IF NOT EXISTS data_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE SET NULL,
  requestor_email  TEXT NOT NULL,
  request_type     data_request_type_enum NOT NULL,
  status           data_request_status_enum NOT NULL DEFAULT 'pending',
  notes            TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  handled_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT data_requests_email_not_empty CHECK (requestor_email <> '')
);

-- ─── privacy_policy_versions ──────────────────────────────────────────────────
-- Append-only log of all published privacy policy versions.

CREATE TABLE IF NOT EXISTS privacy_policy_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  effective_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_consent_subject_email
  ON consent_records (subject_email);

CREATE INDEX IF NOT EXISTS idx_consent_type
  ON consent_records (consent_type);

CREATE INDEX IF NOT EXISTS idx_consent_tenant_email_type
  ON consent_records (tenant_id, subject_email, consent_type);

CREATE INDEX IF NOT EXISTS idx_consent_given_at
  ON consent_records (given_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_requests_status
  ON data_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_requests_email
  ON data_requests (requestor_email);

CREATE INDEX IF NOT EXISTS idx_data_requests_tenant
  ON data_requests (tenant_id, requested_at DESC);

-- ─── Seed initial privacy policy version ─────────────────────────────────────

INSERT INTO privacy_policy_versions (version, content_markdown, effective_from)
VALUES (
  '1.0',
  E'# Privacy Policy\n\n**Last updated:** January 2025  \n**Effective from:** January 1, 2025\n\n---\n\n## 1. Data Fiduciary\n\nThis platform is operated by the event management company (**Tenant**) that organised the event you are attending. OccasionPro acts as the **Data Processor** on behalf of the Tenant.\n\n## 2. What data we collect\n\n- **Identity data**: Full name, email address, phone number\n- **Event data**: RSVP responses, meal preferences, accommodation requests, check-in records\n- **Communications**: Messages sent through the guest portal\n- **Technical data**: IP address (hashed), device type — used only for security and fraud prevention\n\n## 3. Purpose and legal basis\n\nWe collect and process your personal data solely for the purposes of:\n- Managing your registration and attendance at the event\n- Communicating event-related information\n- Generating entry passes and seating assignments\n- Catering and accommodation arrangements\n\nYour data is processed on the basis of **your explicit consent** given at registration.\n\n## 4. Data sharing\n\nYour data is shared only with:\n- The event organiser (Tenant) and their authorised staff\n- Vendors directly involved in delivering services at your event (caterers, accommodation providers) — only with your consent\n- OccasionPro (as Data Processor) for platform operations\n\nWe **do not sell** your data to any third party.\n\n## 5. Retention\n\nYour personal data is retained for 90 days after the event date, after which it is anonymised unless you request earlier deletion.\n\n## 6. Your Rights under DPDP Act 2023\n\nUnder India''s Digital Personal Data Protection Act 2023, you have the right to:\n\n- **Access**: Obtain a summary of all personal data held about you\n- **Correction**: Request correction of inaccurate or incomplete data\n- **Erasure**: Request deletion of your personal data\n- **Portability**: Receive your data in a machine-readable format\n- **Withdraw Consent**: Withdraw your consent at any time without affecting the lawfulness of prior processing\n- **Nominate**: Nominate another person to exercise these rights on your behalf\n\nTo exercise these rights, visit the **Your Data Rights** page or email the Grievance Officer.\n\n## 7. Grievance Officer\n\nIf you have any complaints or concerns regarding the processing of your personal data, please contact our designated Grievance Officer:\n\n**Email:** grievance@occasionpro.in  \n**Response time:** Within 48 hours of receipt\n\n## 8. Contact\n\nFor any privacy-related queries, contact: **privacy@occasionpro.in**',
  NOW()
) ON CONFLICT (version) DO NOTHING;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE consent_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_policy_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API uses service role)
CREATE POLICY "service_role_all_consent"
  ON consent_records FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_data_requests"
  ON data_requests FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "public_read_privacy_policy"
  ON privacy_policy_versions FOR SELECT USING (TRUE);

CREATE POLICY "service_role_all_privacy_policy"
  ON privacy_policy_versions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Migration: 084_super_admins.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 084: Super Admins Table
--
-- Platform-level super admin table.
-- Guards check: super_admins WHERE user_id = auth.uid() AND is_active = true
--
-- Referenced by:
--   workspace-role.guard.ts  — .eq('user_id', userId)
--   event-access.guard.ts    — .eq('user_id', userId)
--   041_platform_settings.sql — RLS policies
-- ============================================================

-- ── super_admins ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS super_admins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT super_admins_user_id_unique UNIQUE (user_id),
  CONSTRAINT super_admins_email_unique   UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_super_admins_user_id   ON super_admins(user_id)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_super_admins_email     ON super_admins(email);

COMMENT ON TABLE super_admins IS
  'Platform-level super admin accounts. Users in this table bypass all tenant role checks.';

COMMENT ON COLUMN super_admins.user_id IS
  'Maps to auth.users.id — used by workspace-role.guard and event-access.guard.';

-- ── RLS ───────────────────────────────────────────────────

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can read their own record
CREATE POLICY "super_admins_self_read"
  ON super_admins FOR SELECT
  USING (user_id = auth.uid());

-- Only existing super admins can manage this table (via service role in practice)
CREATE POLICY "super_admins_service_all"
  ON super_admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid() AND sa.is_active = true
    )
  );

-- ============================================================
-- Migration: 20240120_tenant_branding.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_branding — per-tenant white-label design token storage
-- Each row holds the full CSS variable set for one tenant.
-- Super Admin can set platform-wide defaults (tenant_id IS NULL) 
-- or override per tenant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = platform default
  -- Core palette (stored as raw HSL channels, e.g. "263 72% 58%")
  primary_hsl         TEXT NOT NULL DEFAULT '263 72% 58%',   -- violet
  secondary_hsl       TEXT NOT NULL DEFAULT '38 92% 50%',    -- gold
  accent_hsl          TEXT NOT NULL DEFAULT '25 95% 53%',    -- coral
  danger_hsl          TEXT NOT NULL DEFAULT '0 84% 60%',
  success_hsl         TEXT NOT NULL DEFAULT '160 84% 39%',
  info_hsl            TEXT NOT NULL DEFAULT '199 89% 48%',
  -- Surfaces (light)
  background_light_hsl TEXT NOT NULL DEFAULT '0 0% 98%',
  card_light_hsl       TEXT NOT NULL DEFAULT '0 0% 100%',
  border_light_hsl     TEXT NOT NULL DEFAULT '220 13% 91%',
  -- Surfaces (dark)
  background_dark_hsl  TEXT NOT NULL DEFAULT '240 14% 7%',
  card_dark_hsl        TEXT NOT NULL DEFAULT '240 13% 10%',
  border_dark_hsl      TEXT NOT NULL DEFAULT '240 10% 22%',
  -- Brand assets
  logo_url            TEXT,
  favicon_url         TEXT,
  -- Typography
  font_family         TEXT NOT NULL DEFAULT 'Inter',
  font_url            TEXT,                                   -- Google Fonts embed URL
  -- Shape
  border_radius       TEXT NOT NULL DEFAULT 'default',       -- 'sharp'|'default'|'rounded'|'pill'
  -- Defaults
  dark_mode_default   BOOLEAN NOT NULL DEFAULT true,
  -- Meta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)   -- one branding row per tenant (NULL = platform)
);

-- Row-level security
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write all rows
CREATE POLICY "super_admin_full_access" ON public.tenant_branding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Tenant members can read their own branding
CREATE POLICY "tenant_member_read" ON public.tenant_branding
  FOR SELECT
  USING (
    tenant_id IS NULL  -- platform default is public
    OR tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tenant_branding_updated_at ON public.tenant_branding;
CREATE TRIGGER tenant_branding_updated_at
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed platform-wide defaults (tenant_id = NULL)
INSERT INTO public.tenant_branding (tenant_id) VALUES (NULL)
ON CONFLICT (tenant_id) DO NOTHING;

