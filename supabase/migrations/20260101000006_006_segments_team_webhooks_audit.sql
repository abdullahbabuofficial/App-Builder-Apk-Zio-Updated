-- =====================================================================
-- PushCare :: 006_segments_team_webhooks_audit.sql
-- Extends the schema with the dashboard-surfaced features that have no
-- backing tables yet: audience segments, team / RBAC, webhooks, audit
-- log, and the billing primitives (plans, subscriptions, usage).
--
-- Conventions inherited from 001-005:
--   * Tenant tables prefix with `app_*` or `org_*` and FK to app_owners
--     ON DELETE CASCADE so workspace teardown is one statement.
--   * Hot append-only tables (webhook_deliveries) are RANGE partitioned
--     monthly the same way app_message_delivery is in 002.
--   * Owner-scoped RLS via current_owner_id() from 004.
--   * Redacted views hide secrets (signing_secret bytea is never shown
--     to authenticated; only the prefix is).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE org_member_role AS ENUM ('owner','admin','developer','viewer','service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE org_sub_status AS ENUM ('trialing','active','past_due','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- app_segments  — saved audience definitions, evaluated lazily.
-- `rules` is a JSON predicate the dispatcher walks; `estimated_size` is
-- the last computed audience count (refreshed by a cron / on-demand).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_segments (
  segment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id            UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  description       TEXT,
  -- Predicate shape (informal):
  --   { country_in: ["BD","IN"],
  --     event_in_last_days: { event: "purchase", days: 7 },
  --     app_version: ">=2.4.0" }
  rules             JSONB NOT NULL DEFAULT '{}'::jsonb,

  estimated_size    BIGINT NOT NULL DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (app_id, name)
);

CREATE INDEX IF NOT EXISTS idx_app_segments_app   ON app_segments(app_id);
CREATE INDEX IF NOT EXISTS idx_app_segments_owner ON app_segments(owner_id);

-- ---------------------------------------------------------------------
-- org_members  — per-workspace seats. owner_id is the workspace, NOT
-- the member identifier; member_user_id maps to auth.users.id once the
-- invite is accepted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_members (
  org_member_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  member_user_id  UUID,                            -- references auth.users(id), nullable until accepted
  member_email    CITEXT NOT NULL,
  role            org_member_role NOT NULL DEFAULT 'developer',
  invited_by      UUID,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_owner       ON org_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user        ON org_members(member_user_id) WHERE member_user_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- org_invites  — pending invitations. The `token` is the opaque value
-- the recipient clicks; we store it plaintext so the link survives a
-- stateless redirect.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_invites (
  invite_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  email        CITEXT NOT NULL,
  role         org_member_role NOT NULL DEFAULT 'developer',
  token        TEXT NOT NULL UNIQUE
                 DEFAULT (encode(gen_random_bytes(16), 'hex')),
  invited_by   UUID,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_owner ON org_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email);

-- ---------------------------------------------------------------------
-- webhook_endpoints  — outbound webhooks.
--
-- The plaintext `whsec_...` secret is shown to the user exactly once at
-- creation; we persist only the sha256 in `signing_secret` and the
-- short prefix for display ("whsec_a1b2c3d4...").
-- app_id NULL ⇒ workspace-wide endpoint (fires on any app's events).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  endpoint_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  app_id                UUID REFERENCES android_apps(app_id) ON DELETE CASCADE,  -- NULL = workspace-wide

  url                   TEXT NOT NULL,
  signing_secret        BYTEA NOT NULL
                          DEFAULT digest(gen_random_bytes(32), 'sha256'),
  signing_secret_prefix TEXT NOT NULL
                          DEFAULT 'whsec_' || encode(gen_random_bytes(4), 'hex'),

  event_types           TEXT[] NOT NULL
                          DEFAULT ARRAY['push.sent','push.delivered','push.failed'],
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_at      TIMESTAMPTZ,
  last_status           SMALLINT,
  description           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_owner_active
  ON webhook_endpoints(owner_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_app
  ON webhook_endpoints(app_id) WHERE app_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- webhook_deliveries  — one row per attempt. RANGE partitioned by
-- created_at on the same monthly cadence as app_message_delivery (002).
--
-- We DO NOT FK endpoint_id at row level — same trade-off documented in
-- 002: the FK check costs more than the integrity is worth at this
-- volume, and orphans are reaped with the partition.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id     BIGINT GENERATED ALWAYS AS IDENTITY,
  endpoint_id     UUID NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  response_status SMALLINT,
  response_body   TEXT,
  attempt_count   SMALLINT NOT NULL DEFAULT 0,
  succeeded       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (created_at, delivery_id)
) PARTITION BY RANGE (created_at);

-- ---------------------------------------------------------------------
-- Helper: create one monthly partition for webhook_deliveries with the
-- per-partition indexes attached. Mirrors create_monthly_partition()
-- from 002 but is scoped to this table only so we don't have to amend
-- the existing function.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_webhook_delivery_partition(
  month_start DATE
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  partition_name TEXT;
  range_start    TEXT;
  range_end      TEXT;
BEGIN
  partition_name := format('webhook_deliveries_%s', to_char(month_start, 'YYYY_MM'));
  range_start    := month_start::TEXT;
  range_end      := (month_start + INTERVAL '1 month')::DATE::TEXT;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF webhook_deliveries
       FOR VALUES FROM (%L) TO (%L)',
    partition_name, range_start, range_end
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (endpoint_id, created_at DESC)',
    partition_name || '_endpoint_idx', partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (event_type, created_at DESC) WHERE succeeded = FALSE',
    partition_name || '_failed_event_idx', partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING brin (created_at) WITH (pages_per_range = 32)',
    partition_name || '_brin_idx', partition_name
  );
END;
$$;

-- ---------------------------------------------------------------------
-- Provision partitions: previous month + current + next 6 months.
-- (Same window as 002.)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  m DATE;
BEGIN
  FOR m IN
    SELECT generate_series(
      date_trunc('month', NOW())::DATE - INTERVAL '1 month',
      date_trunc('month', NOW())::DATE + INTERVAL '6 month',
      INTERVAL '1 month'
    )::DATE
  LOOP
    PERFORM create_webhook_delivery_partition(m);
  END LOOP;
END $$;

-- Default partition catches stray rows so inserts never fail.
CREATE TABLE IF NOT EXISTS webhook_deliveries_default
  PARTITION OF webhook_deliveries DEFAULT;

-- ---------------------------------------------------------------------
-- audit_log  — append-only, owner-scoped. Insert path is locked down
-- to emit_audit() (SECURITY DEFINER) below; no UPDATE/DELETE policies
-- exist, so even authenticated callers cannot mutate history.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id        UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  actor_user_id   UUID,
  actor_email     CITEXT,
  action          TEXT NOT NULL,                 -- e.g. 'app.created', 'campaign.sent', 'key.revoked'
  target_type     TEXT,
  target_id       TEXT,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip              INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_owner_time
  ON audit_log(owner_id, created_at DESC);

-- BRIN: append-mostly with monotonic created_at — tiny on-disk footprint.
CREATE INDEX IF NOT EXISTS brin_audit_log_created
  ON audit_log USING brin (created_at) WITH (pages_per_range = 64);

-- ---------------------------------------------------------------------
-- subscription_plans  — public catalog. Read-open to anon for the
-- marketing surface; writes are blocked entirely (no policy).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  plan_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT UNIQUE NOT NULL,         -- 'free' | 'pro' | 'enterprise'
  name               TEXT NOT NULL,
  monthly_pushes     BIGINT NOT NULL,
  max_apps           INT NOT NULL,
  max_seats          INT NOT NULL,
  monthly_price_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  features           JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed catalog. Idempotent so re-running the migration is safe.
INSERT INTO subscription_plans (code, name, monthly_pushes, max_apps, max_seats, monthly_price_usd, features, sort_order)
VALUES
  ('free',       'Free',       100000,       2,   2,    0,
    '{"push_send": true, "analytics_basic": true, "retention_days": 7}'::jsonb, 1),
  ('pro',        'Pro',        50000000,     25,  5,    249,
    '{"push_send": true, "analytics_advanced": true, "retention_days": 90, "webhooks": true, "segments": true}'::jsonb, 2),
  ('enterprise', 'Enterprise', 1000000000,   200, 50,   1299,
    '{"push_send": true, "analytics_advanced": true, "retention_days": 365, "webhooks": true, "segments": true, "sso": true, "sla": "99.99%"}'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- org_subscriptions  — exactly one per workspace.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_subscriptions (
  subscription_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL UNIQUE REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  plan_id                UUID NOT NULL REFERENCES subscription_plans(plan_id),
  status                 org_sub_status NOT NULL DEFAULT 'trialing',
  current_period_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  cancel_at              TIMESTAMPTZ,
  stripe_customer_id     TEXT,                      -- for future Stripe wire-up
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan
  ON org_subscriptions(plan_id);

-- ---------------------------------------------------------------------
-- usage_counters  — per-month rollup, owner-scoped. Mirrors the daily
-- rollup pattern in 005 (`app_daily_stats`) but at workspace grain so
-- we can enforce plan limits cheaply.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_counters (
  owner_id         UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  period           DATE NOT NULL,                  -- first of month
  pushes_sent      BIGINT NOT NULL DEFAULT 0,
  active_devices   BIGINT NOT NULL DEFAULT 0,
  events_recorded  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_period
  ON usage_counters (period DESC);

-- =====================================================================
-- Helper functions  (SECURITY DEFINER, search_path locked).
-- =====================================================================

-- ---------------------------------------------------------------------
-- emit_audit  — single canonical insert path for audit_log.
-- Resolves owner_id via current_owner_id() and actor via auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION emit_audit(
  p_action      TEXT,
  p_target_type TEXT,
  p_target_id   TEXT,
  p_details     JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_actor    UUID;
  v_email    CITEXT;
BEGIN
  v_owner_id := current_owner_id();
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'audit_no_owner_context' USING ERRCODE = 'P0001';
  END IF;

  v_actor := auth.uid();
  SELECT email INTO v_email FROM app_owners WHERE owner_id = v_owner_id;

  INSERT INTO audit_log (
    owner_id, actor_user_id, actor_email,
    action, target_type, target_id, details
  ) VALUES (
    v_owner_id, v_actor, v_email,
    p_action, p_target_type, p_target_id,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------
-- record_webhook_delivery  — called by the dispatcher (service_role).
-- Inserts a delivery row + bumps last_delivery_at / last_status on the
-- endpoint, in one transaction.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_endpoint_id     UUID,
  p_event_type      TEXT,
  p_payload         JSONB,
  p_response_status SMALLINT,
  p_response_body   TEXT,
  p_attempt_count   SMALLINT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery_id BIGINT;
  v_succeeded   BOOLEAN;
BEGIN
  v_succeeded := p_response_status BETWEEN 200 AND 299;

  INSERT INTO webhook_deliveries (
    endpoint_id, event_type, payload,
    response_status, response_body, attempt_count,
    succeeded, completed_at
  ) VALUES (
    p_endpoint_id, p_event_type, COALESCE(p_payload, '{}'::jsonb),
    p_response_status, p_response_body, COALESCE(p_attempt_count, 0),
    v_succeeded, NOW()
  )
  RETURNING delivery_id INTO v_delivery_id;

  UPDATE webhook_endpoints
     SET last_delivery_at = NOW(),
         last_status      = p_response_status,
         updated_at       = NOW()
   WHERE endpoint_id = p_endpoint_id;

  RETURN v_delivery_id;
END;
$$;

-- ---------------------------------------------------------------------
-- current_org_plan  — resolves the active plan for the calling owner.
-- Used by edge functions to enforce plan caps without an extra round-trip.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_plan()
RETURNS TABLE (
  plan_code      TEXT,
  monthly_pushes BIGINT,
  max_apps       INT,
  max_seats      INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.code, p.monthly_pushes, p.max_apps, p.max_seats
    FROM org_subscriptions s
    JOIN subscription_plans p ON p.plan_id = s.plan_id
   WHERE s.owner_id = current_owner_id();
$$;

-- ---------------------------------------------------------------------
-- roll_webhook_partitions_forward  — companion to roll_partitions_forward
-- in 003. Wire to pg_cron monthly alongside the existing schedule.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION roll_webhook_partitions_forward() RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  next_month DATE := (date_trunc('month', NOW()) + INTERVAL '6 month')::DATE;
BEGIN
  PERFORM create_webhook_delivery_partition(next_month);
END;
$$;

-- =====================================================================
-- Row-level security
-- =====================================================================

ALTER TABLE app_segments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters       ENABLE ROW LEVEL SECURITY;

-- Force on tenant tables — even table owners go through policy.
ALTER TABLE app_segments         FORCE ROW LEVEL SECURITY;
ALTER TABLE org_members          FORCE ROW LEVEL SECURITY;
ALTER TABLE org_invites          FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints    FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries   FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log            FORCE ROW LEVEL SECURITY;
ALTER TABLE org_subscriptions    FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_counters       FORCE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans   FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- app_segments  — owner-scoped CRUD.
-- ---------------------------------------------------------------------
CREATE POLICY segments_owner_all ON app_segments
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- org_members  — owner-scoped CRUD.
-- ---------------------------------------------------------------------
CREATE POLICY org_members_owner_all ON org_members
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- org_invites  — owner-scoped CRUD.
-- ---------------------------------------------------------------------
CREATE POLICY org_invites_owner_all ON org_invites
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- webhook_endpoints  — owner-scoped CRUD. The signing_secret bytea is
-- redacted in v_my_webhooks below; direct table SELECT still returns
-- it, which is fine because only the owner can read their own row.
-- ---------------------------------------------------------------------
CREATE POLICY webhook_endpoints_owner_all ON webhook_endpoints
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- webhook_deliveries  — SELECT only, gated by JOIN to the endpoint's
-- owner_id. INSERT/UPDATE happen exclusively via record_webhook_delivery
-- under service_role.
-- ---------------------------------------------------------------------
CREATE POLICY webhook_deliveries_by_endpoint ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webhook_endpoints e
     WHERE e.endpoint_id = webhook_deliveries.endpoint_id
       AND e.owner_id = current_owner_id()
  ));

-- ---------------------------------------------------------------------
-- audit_log  — owner can SELECT only; INSERT only via emit_audit().
-- No UPDATE/DELETE policies → mutations are blocked by RLS.
-- ---------------------------------------------------------------------
CREATE POLICY audit_log_owner_select ON audit_log
  FOR SELECT TO authenticated
  USING (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- subscription_plans  — public read of public rows. No write policy ⇒
-- inserts/updates/deletes are blocked for anyone but service_role.
-- ---------------------------------------------------------------------
CREATE POLICY subscription_plans_public_read ON subscription_plans
  FOR SELECT TO authenticated, anon
  USING (is_public = TRUE);

-- ---------------------------------------------------------------------
-- org_subscriptions  — owner-scoped CRUD.
-- ---------------------------------------------------------------------
CREATE POLICY org_subscriptions_owner_all ON org_subscriptions
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- ---------------------------------------------------------------------
-- usage_counters  — owner-scoped CRUD.
-- ---------------------------------------------------------------------
CREATE POLICY usage_counters_owner_all ON usage_counters
  FOR ALL TO authenticated
  USING (owner_id = current_owner_id())
  WITH CHECK (owner_id = current_owner_id());

-- =====================================================================
-- Redacted views  (mirror v_my_apps / v_subscriber_status pattern in 004)
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_my_team
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_my_team AS
  SELECT org_member_id, owner_id, member_user_id, member_email,
         role, invited_by, accepted_at, created_at, updated_at
    FROM org_members
   WHERE owner_id = current_owner_id();

GRANT SELECT ON v_my_team TO authenticated;

-- ---------------------------------------------------------------------
-- v_my_webhooks  — excludes the signing_secret bytea; only the prefix
-- is exposed (the plaintext was shown once at creation).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_my_webhooks AS
  SELECT endpoint_id, owner_id, app_id, url,
         signing_secret_prefix,
         event_types, is_active,
         last_delivery_at, last_status, description,
         created_at, updated_at
    FROM webhook_endpoints
   WHERE owner_id = current_owner_id();

GRANT SELECT ON v_my_webhooks TO authenticated;

-- ---------------------------------------------------------------------
-- v_my_subscription  — single row joining the active subscription with
-- its plan. Caller's plan caps are reachable in one round-trip.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_my_subscription AS
  SELECT s.subscription_id, s.owner_id, s.status,
         s.current_period_start, s.current_period_end, s.cancel_at,
         s.stripe_customer_id, s.created_at, s.updated_at,
         p.plan_id, p.code AS plan_code, p.name AS plan_name,
         p.monthly_pushes, p.max_apps, p.max_seats,
         p.monthly_price_usd, p.features
    FROM org_subscriptions s
    JOIN subscription_plans p ON p.plan_id = s.plan_id
   WHERE s.owner_id = current_owner_id();

GRANT SELECT ON v_my_subscription TO authenticated;

-- =====================================================================
-- Function ACLs
-- =====================================================================

-- emit_audit: any authenticated caller can record their own actions.
REVOKE ALL ON FUNCTION emit_audit(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION emit_audit(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- record_webhook_delivery: dispatcher only.
REVOKE ALL ON FUNCTION record_webhook_delivery(UUID, TEXT, JSONB, SMALLINT, TEXT, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_webhook_delivery(UUID, TEXT, JSONB, SMALLINT, TEXT, SMALLINT) TO service_role;

-- current_org_plan: any authenticated caller — STABLE, no side effects.
REVOKE ALL ON FUNCTION current_org_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_org_plan() TO authenticated;

-- Partition rollers: service_role only (called by pg_cron).
REVOKE ALL ON FUNCTION create_webhook_delivery_partition(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION roll_webhook_partitions_forward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_webhook_delivery_partition(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION roll_webhook_partitions_forward() TO service_role;

-- ---------------------------------------------------------------------
-- pg_cron schedule (set up after enabling extension):
--
--   SELECT cron.schedule('roll_webhook_partitions', '0 3 1 * *',
--     'SELECT roll_webhook_partitions_forward()');
-- ---------------------------------------------------------------------
