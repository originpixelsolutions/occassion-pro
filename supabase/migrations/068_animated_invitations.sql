-- ============================================================
-- OccasionPro — Migration 068: Animated Digital Invitation Builder
-- Personalized guest invitation links with themed animated viewer
-- ============================================================

-- ── invitation_templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitation_templates (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid         REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = system template
  name           varchar(100) NOT NULL,
  theme_slug     varchar(50)  NOT NULL,
  thumbnail_url  text,
  config         jsonb        NOT NULL DEFAULT '{}',
  is_system      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_templates_tenant  ON invitation_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_templates_system  ON invitation_templates(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_inv_templates_slug    ON invitation_templates(theme_slug);

-- ── event_invitations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_invitations (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id    uuid         NOT NULL REFERENCES invitation_templates(id),
  custom_config  jsonb        NOT NULL DEFAULT '{}',   -- tenant overrides merged on top of template config
  is_published   boolean      NOT NULL DEFAULT false,
  published_at   timestamptz,
  created_by     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id)                                     -- one invitation per event
);

CREATE INDEX IF NOT EXISTS idx_event_inv_event    ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inv_template ON event_invitations(template_id);

-- ── guest_invitation_links ────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_invitation_links (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id             uuid         NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  invitation_id        uuid         NOT NULL REFERENCES event_invitations(id) ON DELETE CASCADE,
  short_link_id        uuid         REFERENCES short_links(id) ON DELETE SET NULL,
  personalized_message text,
  is_opened            boolean      NOT NULL DEFAULT false,
  opened_at            timestamptz,
  open_count           integer      NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_gil_event        ON guest_invitation_links(event_id);
CREATE INDEX IF NOT EXISTS idx_gil_guest        ON guest_invitation_links(guest_id);
CREATE INDEX IF NOT EXISTS idx_gil_invitation   ON guest_invitation_links(invitation_id);
CREATE INDEX IF NOT EXISTS idx_gil_short_link   ON guest_invitation_links(short_link_id) WHERE short_link_id IS NOT NULL;

-- ── Trigger: auto-create short_link on guest_invitation_links insert ──
CREATE OR REPLACE FUNCTION fn_create_invitation_short_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code      varchar(10);
  v_link_id   uuid;
  v_tenant_id uuid;
BEGIN
  -- Get tenant_id from the event
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = NEW.event_id;

  -- Generate unique short code
  v_code := generate_short_code();

  -- Insert the short link record
  INSERT INTO short_links (
    code, tenant_id, event_id, link_type,
    destination_url, guest_id, metadata
  )
  VALUES (
    v_code,
    v_tenant_id,
    NEW.event_id,
    'invitation',
    '/i/' || v_code,
    NEW.guest_id,
    jsonb_build_object('invitation_id', NEW.invitation_id, 'guest_link_id', NEW.id)
  )
  RETURNING id INTO v_link_id;

  -- Back-fill the FK on the row we just inserted
  UPDATE guest_invitation_links
  SET short_link_id = v_link_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitation_short_link ON guest_invitation_links;
CREATE TRIGGER trg_invitation_short_link
  AFTER INSERT ON guest_invitation_links
  FOR EACH ROW
  WHEN (NEW.short_link_id IS NULL)
  EXECUTE FUNCTION fn_create_invitation_short_link();

-- ── Timestamp trigger for event_invitations ───────────────────
CREATE OR REPLACE FUNCTION fn_event_inv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_inv_updated_at ON event_invitations;
CREATE TRIGGER trg_event_inv_updated_at
  BEFORE UPDATE ON event_invitations
  FOR EACH ROW EXECUTE FUNCTION fn_event_inv_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE invitation_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_invitation_links  ENABLE ROW LEVEL SECURITY;

-- System templates readable by all authenticated users
CREATE POLICY inv_templates_system_read ON invitation_templates
  FOR SELECT USING (is_system = true);

-- Tenant custom templates readable/writable by tenant members
CREATE POLICY inv_templates_tenant_all ON invitation_templates
  FOR ALL USING (
    tenant_id IS NOT NULL AND
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Event invitations — tenant members of the event's workspace
CREATE POLICY event_inv_tenant_all ON event_invitations
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Guest invitation links — tenant members
CREATE POLICY gil_tenant_all ON guest_invitation_links
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Public read for invitation links (guests open via short link — no auth)
CREATE POLICY gil_public_read ON guest_invitation_links
  FOR SELECT USING (true);

CREATE POLICY event_inv_public_read ON event_invitations
  FOR SELECT USING (is_published = true);

CREATE POLICY inv_templates_public_read ON invitation_templates
  FOR SELECT USING (true);

-- Super admin full access
CREATE POLICY inv_templates_super_admin ON invitation_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY event_inv_super_admin ON event_invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY gil_super_admin ON guest_invitation_links
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Service role bypass (for backend operations)
CREATE POLICY inv_templates_service ON invitation_templates
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY event_inv_service ON event_invitations
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY gil_service ON guest_invitation_links
  FOR ALL USING (auth.role() = 'service_role');

-- ── Seed: 10 System Invitation Themes ────────────────────────
INSERT INTO invitation_templates (id, name, theme_slug, thumbnail_url, config, is_system) VALUES

-- 1. Royal Gold
(gen_random_uuid(), 'Royal Gold', 'royal-gold', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#1a0a00 0%,#2d1400 50%,#1a0a00 100%)"},"primaryColor":"#c9a84c","accentColor":"#f5d88a","textColor":"#f5e6c8","fontHeading":"Cormorant Garamond","fontBody":"Libre Baskerville","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["geometric-border","crown-motif","gold-particles"],"musicEnabled":false}',
  true),

-- 2. Minimal White
(gen_random_uuid(), 'Minimal White', 'minimal-white', NULL,
  '{"background":{"type":"solid","value":"#fafafa"},"primaryColor":"#1a1a1a","accentColor":"#888888","textColor":"#1a1a1a","fontHeading":"Playfair Display","fontBody":"Lato","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["thin-line"],"musicEnabled":false}',
  true),

-- 3. Floral Pink
(gen_random_uuid(), 'Floral Pink', 'floral-pink', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#fce4ec 0%,#f8bbd0 40%,#f48fb1 100%)"},"primaryColor":"#c2185b","accentColor":"#e91e63","textColor":"#880e4f","fontHeading":"Dancing Script","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["rose-petals","floral-border","butterflies"],"musicEnabled":false}',
  true),

-- 4. Dark Luxury
(gen_random_uuid(), 'Dark Luxury', 'dark-luxury', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0a0a 0%,#1a1a2e 50%,#0a0a0a 100%)"},"primaryColor":"#e8e8e8","accentColor":"#b8860b","textColor":"#f0f0f0","fontHeading":"Cinzel","fontBody":"Cormorant Garamond","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["diamond-pattern","silver-sparkles","luxury-border"],"musicEnabled":false}',
  true),

-- 5. Pastel Dream
(gen_random_uuid(), 'Pastel Dream', 'pastel-dream', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#e0f7fa 0%,#fce4ec 50%,#f3e5f5 100%)"},"primaryColor":"#7b1fa2","accentColor":"#ff6f00","textColor":"#4a148c","fontHeading":"Pacifico","fontBody":"Nunito","animationStyle":"playful","animationSpeed":"medium","decorativeElements":["stars","balloons","confetti-static"],"musicEnabled":false}',
  true),

-- 6. Vibrant Festival
(gen_random_uuid(), 'Vibrant Festival', 'vibrant-festival', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#ff6b35 0%,#f7c59f 30%,#efefd0 60%,#004e89 100%)"},"primaryColor":"#ff6b35","accentColor":"#f7c59f","textColor":"#ffffff","fontHeading":"Righteous","fontBody":"Nunito","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["fireworks","lanterns","rangoli"],"musicEnabled":false}',
  true),

-- 7. Corporate Blue
(gen_random_uuid(), 'Corporate Blue', 'corporate-blue', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#0d1b2a 0%,#1b2838 60%,#162032 100%)"},"primaryColor":"#4fc3f7","accentColor":"#ffffff","textColor":"#e3f2fd","fontHeading":"Montserrat","fontBody":"Open Sans","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["grid-pattern","circuit-lines"],"musicEnabled":false}',
  true),

-- 8. Rustic Wood
(gen_random_uuid(), 'Rustic Wood', 'rustic-wood', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#3e1c00 0%,#6d3a1f 50%,#4e2400 100%)"},"primaryColor":"#d4a853","accentColor":"#f5deb3","textColor":"#faebd7","fontHeading":"Abril Fatface","fontBody":"Merriweather","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["wood-grain","leaves","twine-border"],"musicEnabled":false}',
  true),

-- 9. Starry Night
(gen_random_uuid(), 'Starry Night', 'starry-night', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0520 0%,#1a0845 50%,#0a0520 100%)"},"primaryColor":"#a78bfa","accentColor":"#c4b5fd","textColor":"#e9d5ff","fontHeading":"Cormorant Garamond","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["animated-stars","moon","constellation-lines"],"musicEnabled":false}',
  true),

-- 10. Neon Party
(gen_random_uuid(), 'Neon Party', 'neon-party', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#0d0d0d 0%,#1a0030 50%,#0d0d0d 100%)"},"primaryColor":"#ff00c8","accentColor":"#00e5ff","textColor":"#ffffff","fontHeading":"Orbitron","fontBody":"Exo 2","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["neon-glow","electric-lines","disco-balls"],"musicEnabled":false}',
  true);

COMMENT ON TABLE invitation_templates IS 'System and tenant-custom animated invitation themes';
COMMENT ON TABLE event_invitations IS 'One invitation configuration per event, with template + custom overrides';
COMMENT ON TABLE guest_invitation_links IS 'Per-guest personalized invitation links with open tracking';
COMMENT ON FUNCTION fn_create_invitation_short_link IS 'Auto-creates a short_link entry when a guest invitation link is inserted';
