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
