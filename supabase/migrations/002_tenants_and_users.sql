-- ============================================================
-- OccasionPro — Migration 002: Tenants & Users (Multi-Tenant Core)
-- ============================================================

-- ── TENANTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,          -- used in subdomain: slug.occasionpro.in
  logo_url        TEXT,
  website         TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB DEFAULT '{}',            -- {line1, line2, city, state, country, zip}
  timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency        TEXT NOT NULL DEFAULT 'INR',
  country         TEXT NOT NULL DEFAULT 'IN',
  plan            plan_tier NOT NULL DEFAULT 'free',
  status          tenant_status NOT NULL DEFAULT 'trial',
  trial_ends_at   TIMESTAMPTZ,
  settings        JSONB NOT NULL DEFAULT '{}',   -- feature toggles, preferences
  metadata        JSONB NOT NULL DEFAULT '{}',   -- custom fields, integrations
  razorpay_account_id TEXT,                      -- for Route payouts
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ── WHITE LABEL CONFIG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS white_label_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  custom_domain   TEXT UNIQUE,                   -- e.g. app.myclientbrand.com
  brand_name      TEXT,
  primary_color   TEXT DEFAULT '#1D4ED8',
  accent_color    TEXT DEFAULT '#06B6D4',
  logo_url        TEXT,
  favicon_url     TEXT,
  font_family     TEXT DEFAULT 'Inter',
  email_from_name TEXT,
  email_from_addr TEXT,
  custom_css      TEXT,
  ssl_verified    BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_tenant ON white_label_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wl_domain ON white_label_configs(custom_domain);

-- ── TENANT SUBSCRIPTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                plan_tier NOT NULL,
  razorpay_sub_id     TEXT,
  status              TEXT NOT NULL DEFAULT 'active', -- active | paused | cancelled
  billing_cycle       TEXT NOT NULL DEFAULT 'monthly', -- monthly | yearly
  amount              NUMERIC(12,2),
  currency            TEXT NOT NULL DEFAULT 'INR',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_tenant ON tenant_subscriptions(tenant_id);

-- ── PROFILES (extends auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  full_name       TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  language        TEXT DEFAULT 'en',
  is_super_admin  BOOLEAN NOT NULL DEFAULT false,
  last_seen_at    TIMESTAMPTZ,
  onboarded       BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- ── USER ROLES ───────────────────────────────────────────────
-- A user can have different roles across different tenants
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  permissions     JSONB NOT NULL DEFAULT '{}',   -- fine-grained permission overrides
  is_active       BOOLEAN NOT NULL DEFAULT true,
  invited_by      UUID REFERENCES profiles(id),
  invited_at      TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ── INVITATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            user_role NOT NULL,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID REFERENCES profiles(id),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- ── AUDIT LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,                 -- create_event, update_invoice, delete_guest, etc.
  resource_type   TEXT NOT NULL,                 -- events, invoices, guests, etc.
  resource_id     UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  resource_type   TEXT,
  resource_id     UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ── AUTO-UPDATE TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_roles_updated_at ON user_roles;
CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS wl_updated_at ON white_label_configs;
CREATE TRIGGER wl_updated_at BEFORE UPDATE ON white_label_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS subs_updated_at ON tenant_subscriptions;
CREATE TRIGGER subs_updated_at BEFORE UPDATE ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
