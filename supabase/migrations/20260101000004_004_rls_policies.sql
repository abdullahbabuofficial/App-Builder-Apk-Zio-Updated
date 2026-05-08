-- =====================================================================
-- ApkZio :: 004_rls_policies.sql
-- Row-level security.
--
-- Two access patterns:
--   1. SDK / Edge Functions  → use service_role and bypass RLS, but
--      every call is scoped through SECURITY DEFINER functions that
--      verify app_key.
--   2. Dashboard users       → JWT with sub = auth.users.id; we look
--      up app_owners.auth_user_id to scope visibility.
--
-- We FORCE row-level security on tenant tables so even a leaked anon
-- key can't read another tenant's data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: which app_owners row does the current JWT belong to?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_owner_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT owner_id FROM app_owners WHERE auth_user_id = (SELECT auth.uid());
$$;

GRANT EXECUTE ON FUNCTION current_owner_id() TO authenticated;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
ALTER TABLE app_owners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE android_apps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_counter_shards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_devices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_subscribers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_push_notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_message_delivery    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_heartbeats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_analytics_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE apk_builds              ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets      ENABLE ROW LEVEL SECURITY;

-- Force on tenant tables (so even table owners go through policy).
ALTER TABLE app_subscribers         FORCE ROW LEVEL SECURITY;
ALTER TABLE app_devices             FORCE ROW LEVEL SECURITY;
ALTER TABLE app_message_delivery    FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys                FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Policies: app_owners
-- ---------------------------------------------------------------------
CREATE POLICY owner_self_select ON app_owners
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY owner_self_update ON app_owners
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------
-- android_apps
-- ---------------------------------------------------------------------
CREATE POLICY apps_owner_all ON android_apps
  FOR ALL TO authenticated
  USING (owner_id = (SELECT current_owner_id()))
  WITH CHECK (owner_id = (SELECT current_owner_id()));

-- We do NOT expose app_secret_hash to authenticated. Use a view instead.
CREATE OR REPLACE VIEW v_my_apps AS
  SELECT app_id, owner_id, app_key, package_name, app_name, icon_url,
         status, total_installs, active_installs, total_uninstalls,
         live_users, counters_synced_at, metadata, created_at, updated_at
    FROM android_apps
   WHERE owner_id = (SELECT current_owner_id());

GRANT SELECT ON v_my_apps TO authenticated;

-- ---------------------------------------------------------------------
-- Devices, subscribers, heartbeats, events, deliveries: scoped via
-- a join through android_apps.owner_id.
-- ---------------------------------------------------------------------
CREATE POLICY devices_by_app ON app_devices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_devices.app_id
       AND a.owner_id = (SELECT current_owner_id())
  ));

-- Subscribers: never expose fcm_token directly. Use a redacted view.
CREATE POLICY subscribers_by_app ON app_subscribers
  FOR SELECT TO authenticated
  USING (FALSE);   -- no direct access, ever, even for owners

CREATE OR REPLACE VIEW v_subscriber_status AS
  SELECT s.subscriber_id, s.app_id, s.device_id,
         -- redacted: only first/last 4 chars of token
         left(s.fcm_token, 4) || '...' || right(s.fcm_token, 4) AS token_preview,
         s.is_valid, s.invalid_reason, s.last_validated_at, s.created_at
    FROM app_subscribers s
    JOIN android_apps a ON a.app_id = s.app_id
   WHERE a.owner_id = (SELECT current_owner_id());

GRANT SELECT ON v_subscriber_status TO authenticated;

CREATE POLICY heartbeats_by_app ON app_heartbeats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_heartbeats.app_id
       AND a.owner_id = (SELECT current_owner_id())
  ));

CREATE POLICY events_by_app ON app_analytics_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_analytics_events.app_id
       AND a.owner_id = (SELECT current_owner_id())
  ));

CREATE POLICY deliveries_by_app ON app_message_delivery
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_message_delivery.app_id
       AND a.owner_id = (SELECT current_owner_id())
  ));

CREATE POLICY notifs_owner ON app_push_notifications
  FOR ALL TO authenticated
  USING (owner_id = (SELECT current_owner_id()))
  WITH CHECK (owner_id = (SELECT current_owner_id()));

CREATE POLICY apk_builds_owner ON apk_builds
  FOR ALL TO authenticated
  USING (owner_id = (SELECT current_owner_id()))
  WITH CHECK (owner_id = (SELECT current_owner_id()));

CREATE POLICY counter_shards_by_app ON app_counter_shards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_counter_shards.app_id
       AND a.owner_id = (SELECT current_owner_id())
  ));

-- ---------------------------------------------------------------------
-- API keys: owner sees their own, but never the hash.
-- ---------------------------------------------------------------------
CREATE POLICY api_keys_owner ON api_keys
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT current_owner_id()));

CREATE OR REPLACE VIEW v_my_api_keys AS
  SELECT key_id, app_id, key_prefix, scopes, rate_limit_rpm,
         is_active, last_used_at, created_at, expires_at
    FROM api_keys
   WHERE owner_id = (SELECT current_owner_id());

GRANT SELECT ON v_my_api_keys TO authenticated;

-- ---------------------------------------------------------------------
-- rate_limit_buckets: never visible to clients. Service-role only.
-- ---------------------------------------------------------------------
CREATE POLICY ratelimit_no_client ON rate_limit_buckets
  FOR ALL TO authenticated USING (FALSE);

-- ---------------------------------------------------------------------
-- Block direct REST access to sensitive RPCs from the anon key.
-- Edge Functions invoke them with service_role, so we GRANT to
-- service_role only.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION sdk_init_device(TEXT, BYTEA, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sdk_record_heartbeat(UUID, UUID, UUID, CHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION sdk_record_event(UUID, UUID, UUID, TEXT, JSONB, CHAR, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION push_target_subscribers(UUID, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION push_record_delivery_batch(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION push_record_engagement(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION sdk_init_device(TEXT, BYTEA, TEXT, JSONB)                          TO service_role;
GRANT EXECUTE ON FUNCTION sdk_record_heartbeat(UUID, UUID, UUID, CHAR, TEXT)                 TO service_role;
GRANT EXECUTE ON FUNCTION sdk_record_event(UUID, UUID, UUID, TEXT, JSONB, CHAR, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION push_target_subscribers(UUID, INTEGER, UUID)                       TO service_role;
GRANT EXECUTE ON FUNCTION push_record_delivery_batch(UUID, UUID, JSONB)                      TO service_role;
GRANT EXECUTE ON FUNCTION push_record_engagement(UUID, UUID, TEXT)                           TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER)                           TO service_role;
