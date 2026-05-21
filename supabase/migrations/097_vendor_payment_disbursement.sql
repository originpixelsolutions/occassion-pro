-- ─────────────────────────────────────────────────────────────
-- Migration 097: Vendor Payment Disbursement
-- Supports: payment milestone scheduling, multi-approver workflow,
--           Razorpay Payout API dispatch, UPI payouts,
--           disbursement reconciliation with budget actuals
-- ─────────────────────────────────────────────────────────────

-- ── Vendor bank/UPI accounts (stored per vendor) ─────────────
CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id    uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  account_type  text NOT NULL DEFAULT 'bank'
                CHECK (account_type IN ('bank', 'upi', 'wallet')),

  -- Bank account details
  account_holder_name  text,
  account_number       text,              -- encrypted in application layer
  ifsc_code            text,
  bank_name            text,
  branch_name          text,

  -- UPI
  upi_id               text,             -- e.g. vendor@upi

  -- Razorpay Fund Account
  razorpay_contact_id      text,         -- created via Razorpay Contacts API
  razorpay_fund_account_id text,         -- created via Razorpay Fund Accounts API

  is_verified   boolean NOT NULL DEFAULT false,
  is_primary    boolean NOT NULL DEFAULT false,
  verified_at   timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (vendor_id, account_type, COALESCE(account_number, ''), COALESCE(upi_id, ''))
);

-- ── Payment schedules (per vendor-event assignment) ───────────
CREATE TABLE IF NOT EXISTS vendor_payment_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  total_amount    numeric(14, 2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'INR',
  notes           text,

  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'cancelled')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, event_id, vendor_id)
);

-- ── Payment milestones (individual tranches) ──────────────────
CREATE TABLE IF NOT EXISTS vendor_payment_milestones (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id          uuid NOT NULL REFERENCES vendor_payment_schedules(id) ON DELETE CASCADE,
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id            uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  name                 text NOT NULL,  -- "Booking Advance", "Pre-event", "Post-event"
  milestone_type       text NOT NULL DEFAULT 'manual'
                       CHECK (milestone_type IN ('booking_advance', 'pre_event', 'post_event', 'manual')),

  amount               numeric(14, 2) NOT NULL,
  percentage_of_total  numeric(5, 2),  -- Optional: stored for reference

  due_date             date,
  trigger_event        text,           -- 'rsvp_confirmed', 'vendor_confirmed', 'event_end', etc.

  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approval_pending', 'approved', 'rejected', 'processing', 'paid', 'failed')),

  sort_order           int NOT NULL DEFAULT 0,
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Disbursements (actual payment records) ────────────────────
CREATE TABLE IF NOT EXISTS vendor_disbursements (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id         uuid NOT NULL REFERENCES vendor_payment_milestones(id) ON DELETE CASCADE,
  schedule_id          uuid NOT NULL REFERENCES vendor_payment_schedules(id) ON DELETE CASCADE,
  vendor_id            uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  bank_account_id      uuid REFERENCES vendor_bank_accounts(id) ON DELETE SET NULL,
  initiated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  amount               numeric(14, 2) NOT NULL,
  currency             text NOT NULL DEFAULT 'INR',
  payment_mode         text NOT NULL DEFAULT 'bank_transfer'
                       CHECK (payment_mode IN ('bank_transfer', 'upi', 'neft', 'rtgs', 'imps')),

  -- Razorpay Payout
  razorpay_payout_id   text,
  razorpay_payout_link text,
  razorpay_fund_account_id text,

  -- Status lifecycle
  status               text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'processing', 'processed', 'reversed', 'cancelled', 'failed')),

  failure_reason       text,
  reference_number     text,           -- Bank UTR / UPI ref
  processed_at         timestamptz,
  reversed_at          timestamptz,
  failed_at            timestamptz,

  narration            text,           -- Appears on bank statement

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Approval workflow ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disbursement_approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id   uuid NOT NULL REFERENCES vendor_payment_milestones(id) ON DELETE CASCADE,
  approver_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),

  comments       text,
  decided_at     timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (milestone_id, approver_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor    ON vendor_bank_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_schedules_event ON vendor_payment_schedules(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_schedules_vendor ON vendor_payment_schedules(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_milestones_schedule ON vendor_payment_milestones(schedule_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_milestones_status ON vendor_payment_milestones(status);
CREATE INDEX IF NOT EXISTS idx_vendor_disbursements_milestone  ON vendor_disbursements(milestone_id);
CREATE INDEX IF NOT EXISTS idx_vendor_disbursements_vendor     ON vendor_disbursements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_disbursements_status     ON vendor_disbursements(status);
CREATE INDEX IF NOT EXISTS idx_disbursement_approvals_milestone ON disbursement_approvals(milestone_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_approvals_approver  ON disbursement_approvals(approver_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE vendor_bank_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payment_schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payment_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_disbursements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE disbursement_approvals       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_vendor_bank_accounts" ON vendor_bank_accounts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_vendor_payment_schedules" ON vendor_payment_schedules
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_vendor_payment_milestones" ON vendor_payment_milestones
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_vendor_disbursements" ON vendor_disbursements
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_disbursement_approvals" ON disbursement_approvals
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── View: Disbursement reconciliation summary ─────────────────
CREATE OR REPLACE VIEW vendor_disbursement_summary AS
SELECT
  vps.id AS schedule_id,
  vps.tenant_id,
  vps.event_id,
  vps.vendor_id,
  vps.total_amount,
  vps.currency,
  vps.status AS schedule_status,
  COUNT(vpm.id) AS total_milestones,
  COUNT(vpm.id) FILTER (WHERE vpm.status = 'paid')        AS paid_milestones,
  COUNT(vpm.id) FILTER (WHERE vpm.status = 'pending')     AS pending_milestones,
  COUNT(vpm.id) FILTER (WHERE vpm.status = 'approval_pending') AS awaiting_approval,
  COALESCE(SUM(vd.amount) FILTER (WHERE vd.status = 'processed'), 0) AS total_disbursed,
  COALESCE(SUM(vpm.amount) FILTER (WHERE vpm.status = 'pending'), 0) AS total_outstanding,
  vps.total_amount - COALESCE(SUM(vd.amount) FILTER (WHERE vd.status = 'processed'), 0) AS balance_due
FROM vendor_payment_schedules vps
LEFT JOIN vendor_payment_milestones vpm ON vpm.schedule_id = vps.id
LEFT JOIN vendor_disbursements vd       ON vd.milestone_id  = vpm.id
GROUP BY vps.id, vps.tenant_id, vps.event_id, vps.vendor_id, vps.total_amount, vps.currency, vps.status;
