-- ============================================================
-- Migration 047: Cross-Module Real-time Triggers
-- All modules interconnected via PostgreSQL triggers.
-- Changes in one module propagate to dependent modules instantly.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ENABLE REALTIME on all core tables
-- ─────────────────────────────────────────────────────────────

-- Note: In Supabase, realtime is enabled per-publication.
-- Run these in Supabase dashboard or via CLI:
-- ALTER PUBLICATION supabase_realtime ADD TABLE guests;
-- (Listed here for documentation — Supabase runs these via the dashboard toggle)

-- ─────────────────────────────────────────────────────────────
-- HELPER: notify_module_change
-- Broadcasts a custom NOTIFY event for edge functions / API to pick up
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_module_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'module_change',
    json_build_object(
      'table',   TG_TABLE_NAME,
      'event',   TG_OP,
      'tenant',  COALESCE(NEW.tenant_id, OLD.tenant_id),
      'event_id',COALESCE(NEW.event_id, OLD.event_id),
      'id',      COALESCE(NEW.id, OLD.id),
      'ts',      extract(epoch from now())
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. GUEST CHECK-IN → Multiple modules
-- When a guest checks in:
--   a) Update event check-in counters
--   b) Decrement F&B token availability
--   c) Update floor plan presence
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_guest_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id uuid := NEW.event_id;
BEGIN
  -- Only fire when status changes TO checked_in
  IF NEW.check_in_status = 'checked_in' AND (OLD.check_in_status IS DISTINCT FROM 'checked_in') THEN

    -- Update event live counters (if events table has these counters)
    UPDATE events
    SET
      live_checkin_count = COALESCE(live_checkin_count, 0) + 1,
      updated_at = now()
    WHERE id = v_event_id;

    -- Decrement token count for this guest (meal token auto-issued on check-in)
    -- Only if F&B token system is enabled for this event
    UPDATE fnb_serving_sessions
    SET
      tokens_redeemed = COALESCE(tokens_redeemed, 0) + 1,
      updated_at = now()
    WHERE event_id = v_event_id
      AND is_token_system = true
      AND session_type = 'main_meal';

    -- Recalculate event health score
    PERFORM recalculate_event_health(v_event_id);

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_guest_checkin ON guests;
CREATE TRIGGER on_guest_checkin
  AFTER UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION handle_guest_checkin();

-- ─────────────────────────────────────────────────────────────
-- 2. GUEST RSVP CHANGE → Health score + headcount + F&B
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_rsvp_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.rsvp_status IS DISTINCT FROM NEW.rsvp_status THEN
    -- Recalculate event health score (includes headcount prediction)
    PERFORM recalculate_event_health(NEW.event_id);

    -- Update event RSVP counts cache
    UPDATE events SET
      rsvp_yes_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'confirmed'
      ),
      rsvp_no_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'declined'
      ),
      rsvp_pending_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'pending'
      ),
      updated_at = now()
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rsvp_change ON guests;
CREATE TRIGGER on_rsvp_change
  AFTER UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION handle_rsvp_change();

-- ─────────────────────────────────────────────────────────────
-- 3. VENDOR PAYMENT → Budget actuals
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_vendor_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_budget_category_id uuid;
BEGIN
  -- Find the budget item linked to this vendor
  SELECT bc.id INTO v_budget_category_id
  FROM budget_items bi
  JOIN budget_categories bc ON bc.id = bi.category_id
  WHERE bi.vendor_id = NEW.vendor_id
    AND bc.event_id = NEW.event_id
  LIMIT 1;

  IF v_budget_category_id IS NOT NULL THEN
    -- Recalculate actual spend for this budget category
    UPDATE budget_categories
    SET
      actual_amount = (
        SELECT COALESCE(SUM(vp.amount), 0)
        FROM vendor_payments vp
        JOIN vendors v ON v.id = vp.vendor_id
        JOIN budget_items bi ON bi.vendor_id = v.id
        WHERE bi.category_id = budget_categories.id
          AND vp.status = 'completed'
      ),
      updated_at = now()
    WHERE id = v_budget_category_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vendor_payment ON vendor_payments;
CREATE TRIGGER on_vendor_payment
  AFTER INSERT OR UPDATE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_vendor_payment();

-- ─────────────────────────────────────────────────────────────
-- 4. INVOICE PAYMENT → Budget actuals + Client balance
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_invoice_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Update invoice paid_amount
  UPDATE invoices
  SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_payments
      WHERE invoice_id = NEW.invoice_id
        AND status = 'confirmed'
    ),
    updated_at = now()
  WHERE id = NEW.invoice_id;

  -- Update invoice status based on payment
  UPDATE invoices
  SET
    status = CASE
      WHEN paid_amount >= total_amount THEN 'paid'
      WHEN paid_amount > 0 THEN 'partially_paid'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_payment ON invoice_payments;
CREATE TRIGGER on_invoice_payment
  AFTER INSERT OR UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_invoice_payment();

-- ─────────────────────────────────────────────────────────────
-- 5. RUNSHEET TASK COMPLETION → Unlock dependencies
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Unlock tasks that were blocked by this task
    UPDATE runsheet_tasks
    SET
      is_locked = false,
      updated_at = now()
    WHERE event_id = NEW.event_id
      AND depends_on_task_id = NEW.id
      AND is_locked = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_completion ON runsheet_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE ON runsheet_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- ─────────────────────────────────────────────────────────────
-- 6. ACCOMMODATION ASSIGNMENT → Guest profile update
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_accommodation_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL THEN
    -- Update guest profile with room number
    UPDATE guests
    SET
      accommodation_room_id = NEW.room_id,
      updated_at = now()
    WHERE id = NEW.guest_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_accommodation_assignment ON accommodation_allocations;
CREATE TRIGGER on_accommodation_assignment
  AFTER INSERT OR UPDATE ON accommodation_allocations
  FOR EACH ROW
  EXECUTE FUNCTION handle_accommodation_assignment();

-- ─────────────────────────────────────────────────────────────
-- 7. EVENT HEALTH SCORE — Recalculation function
-- Called by multiple triggers above.
-- Composite score (0-100) based on:
--   - RSVP rate (25%)
--   - Budget utilisation (25%)
--   - Task completion (25%)
--   - Vendor confirmation (25%)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_event_health(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rsvp_score      numeric := 0;
  v_budget_score    numeric := 0;
  v_task_score      numeric := 0;
  v_vendor_score    numeric := 0;
  v_total_guests    integer;
  v_rsvp_confirmed  integer;
  v_total_tasks     integer;
  v_completed_tasks integer;
  v_total_vendors   integer;
  v_confirmed_vendors integer;
  v_budget_used_pct numeric;
  v_health_score    integer;
BEGIN
  -- RSVP score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE rsvp_status = 'confirmed')
  INTO v_total_guests, v_rsvp_confirmed
  FROM guests
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_guests > 0 THEN
    v_rsvp_score := LEAST(100, (v_rsvp_confirmed::numeric / v_total_guests) * 100);
  ELSE
    v_rsvp_score := 50; -- neutral if no guests yet
  END IF;

  -- Task score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_tasks, v_completed_tasks
  FROM runsheet_tasks
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_tasks > 0 THEN
    v_task_score := (v_completed_tasks::numeric / v_total_tasks) * 100;
  ELSE
    v_task_score := 50;
  END IF;

  -- Vendor score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'confirmed')
  INTO v_total_vendors, v_confirmed_vendors
  FROM vendors
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_vendors > 0 THEN
    v_vendor_score := (v_confirmed_vendors::numeric / v_total_vendors) * 100;
  ELSE
    v_vendor_score := 50;
  END IF;

  -- Budget score (good if budget < 90% used; bad if over budget)
  SELECT
    CASE
      WHEN SUM(estimated_amount) > 0
      THEN LEAST(100, (COALESCE(SUM(actual_amount), 0) / SUM(estimated_amount)) * 100)
      ELSE 50
    END
  INTO v_budget_used_pct
  FROM budget_categories
  WHERE event_id = p_event_id;

  -- Budget score: 100 if using 0-80%, declining to 0 at 120%+
  v_budget_score := GREATEST(0, LEAST(100, 100 - GREATEST(0, v_budget_used_pct - 80) * 5));

  -- Composite score (equal weights)
  v_health_score := ROUND((v_rsvp_score + v_task_score + v_vendor_score + v_budget_score) / 4);

  -- Update event
  UPDATE events
  SET
    health_score = v_health_score,
    updated_at = now()
  WHERE id = p_event_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. GUEST TABLE — add missing columns if not present
-- ─────────────────────────────────────────────────────────────

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS accommodation_room_id uuid REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_checkin_count integer GENERATED ALWAYS AS (NULL) STORED; -- placeholder, not used directly

-- ─────────────────────────────────────────────────────────────
-- 9. EVENTS TABLE — live counters & health score
-- ─────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS live_checkin_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_yes_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_no_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_pending_count integer DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 10. RUNSHEET TASKS — dependency columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE runsheet_tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_id uuid REFERENCES runsheet_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 11. VENDOR PAYMENTS — ensure event_id is present
-- ─────────────────────────────────────────────────────────────

-- vendor_payments links through vendors, but add denormalized event_id for trigger efficiency
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;

-- Backfill event_id from vendors table
UPDATE vendor_payments vp
SET event_id = v.event_id
FROM vendors v
WHERE v.id = vp.vendor_id
  AND vp.event_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 12. F&B SERVING SESSIONS — token tracking columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE fnb_serving_sessions
  ADD COLUMN IF NOT EXISTS is_token_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tokens_issued integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_redeemed integer DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- INDEXES for trigger performance
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_guests_event_rsvp      ON guests(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_event_checkin    ON guests(event_id, check_in_status);
CREATE INDEX IF NOT EXISTS idx_runsheet_tasks_dep      ON runsheet_tasks(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_event   ON vendor_payments(event_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv    ON invoice_payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_accommodation_alloc_guest ON accommodation_allocations(guest_id);
