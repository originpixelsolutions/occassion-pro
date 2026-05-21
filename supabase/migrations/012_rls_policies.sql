-- ============================================================
-- OccasionPro — Migration 012: Row Level Security Policies
-- ============================================================
-- Every table is locked down by tenant_id.
-- Users can only access data belonging to their tenant.
-- Super admins bypass RLS via service role key (server-side only).
-- ============================================================

-- ── ENABLE RLS ON ALL TABLES ─────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_runsheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_print_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ── HELPER FUNCTION: get current user's tenant ───────────────
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: get current user's role ─────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_roles
  WHERE user_id = auth.uid()
    AND tenant_id = current_user_tenant_id()
    AND is_active = true
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: check if super admin ───────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT is_super_admin FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: tenant isolation check ─────────────────
-- Reusable predicate: does a table row belong to current user's tenant?
CREATE OR REPLACE FUNCTION belongs_to_tenant(row_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT row_tenant_id = current_user_tenant_id() OR is_super_admin()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── PROFILES POLICY ──────────────────────────────────────────
-- Users can read their own profile; tenant members can see each other
DO $$ BEGIN
  CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STANDARD TENANT ISOLATION MACRO ─────────────────────────
-- For each table with tenant_id: SELECT/INSERT/UPDATE/DELETE limited to own tenant
-- Applying to all major tables:

-- EVENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - events" ON events FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EVENT TASKS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - tasks" ON event_tasks FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EVENT RUNSHEET
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - runsheet" ON event_runsheet FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BUDGETS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - budgets" ON budgets FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BUDGET LINE ITEMS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - budget_line_items" ON budget_line_items FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INVOICES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - invoices" ON invoices FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PAYMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - payments" ON payments FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EXPENSES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - expenses" ON expenses FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDOR PAYOUTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendor_payouts" ON vendor_payouts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CONTACTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - contacts" ON contacts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - leads" ON leads FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENUES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - venues" ON venues FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLANS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plans" ON floor_plans FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLAN ZONES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plan_zones" ON floor_plan_zones FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLAN ELEMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plan_elements" ON floor_plan_elements FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDORS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendors" ON vendors FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDOR CONTRACTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendor_contracts" ON vendor_contracts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GUESTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - guests" ON guests FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CHECKIN LOGS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - checkin_logs" ON checkin_logs FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INVENTORY ITEMS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - inventory_items" ON inventory_items FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI GENERATIONS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - ai_generations" ON ai_generations FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTIFICATIONS — users only see their own
DO $$ BEGIN
  CREATE POLICY "Users see own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid() AND belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert notifications" ON notifications FOR INSERT
  WITH CHECK (belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- MICROSITES — public SELECT for published microsites (for microsite pages)
DO $$ BEGIN
  CREATE POLICY "Published microsites are publicly readable" ON microsites FOR SELECT
  USING (status = 'published' OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage microsites" ON microsites FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TICKET TIERS — public SELECT for active tiers on published microsites
DO $$ BEGIN
  CREATE POLICY "Active ticket tiers are publicly readable" ON ticket_tiers FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM microsites WHERE id = microsite_id AND status = 'published'
    ) OR belongs_to_tenant(tenant_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage ticket_tiers" ON ticket_tiers FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TICKET PURCHASES — buyers can see their own
DO $$ BEGIN
  CREATE POLICY "Buyers can see own purchases" ON ticket_purchases FOR SELECT
  USING (buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage ticket_purchases" ON ticket_purchases FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDORS — vendors see their own records
DO $$ BEGIN
  CREATE POLICY "Vendor portal: vendors see own profile"
  ON vendors FOR SELECT
  USING (user_id = auth.uid() OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- COMMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - comments" ON comments FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- USER ROLES
DO $$ BEGIN
  CREATE POLICY "Users can see roles in their tenant" ON user_roles FOR SELECT
  USING (belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Company admins can manage roles" ON user_roles FOR ALL
  USING (belongs_to_tenant(tenant_id) AND current_user_role() IN ('company_admin', 'super_admin'))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
