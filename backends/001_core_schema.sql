-- =====================================================================
-- PushCare :: 001_core_schema.sql
-- Core schema rebuild — optimized for millions of devices.
--
-- Design notes:
--   * Hot append-only tables (heartbeats, events, deliveries) are RANGE
--     partitioned by month so we can drop old data via DETACH/DROP and
--     keep indexes lean.
--   * `app_subscribers` keys on a SHA-256 hash of the FCM token, not the
--     raw token, so upserts are fast and tokens never appear in indexes.
--   * Counters (installs, live_users) are stored in a separate sharded
--     table (`app_counter_shards`) to avoid row-level write contention.
--   * Generated columns push extraction work into the writer once,
--     instead of every read.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------
-- Reference: countries (small, denormalized lookup)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  code        CHAR(2) PRIMARY KEY,
  name        TEXT NOT NULL,
  region      TEXT
);

-- ---------------------------------------------------------------------
-- Tenant: dashboard users / API consumers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_owners (
  owner_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,                 -- maps to auth.users.id
  email        CITEXT UNIQUE NOT NULL,
  display_name TEXT,
  plan         TEXT NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','pro','enterprise')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- android_apps  — one row per published app
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS android_apps (
  app_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,

  -- The public key the SDK ships with. Long, opaque, rotatable.
  app_key         TEXT NOT NULL UNIQUE
                    DEFAULT ('pk_' || encode(gen_random_bytes(24), 'hex')),
  -- Server-side secret for /push/send calls from your dashboard backend.
  app_secret_hash BYTEA NOT NULL
                    DEFAULT digest(gen_random_bytes(32), 'sha256'),

  package_name    TEXT NOT NULL,
  app_name        TEXT,
  icon_url        TEXT,
  fcm_project_id  TEXT,                     -- per-tenant FCM project
  fcm_credentials JSONB,                    -- service-account JSON, encrypted at rest

  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','archived')),

  -- Hot counters live in app_counter_shards; these are last-aggregated values.
  total_installs   BIGINT NOT NULL DEFAULT 0,
  active_installs  BIGINT NOT NULL DEFAULT 0,
  total_uninstalls BIGINT NOT NULL DEFAULT 0,
  live_users       INTEGER NOT NULL DEFAULT 0,
  counters_synced_at TIMESTAMPTZ,

  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (owner_id, package_name)
);

CREATE INDEX IF NOT EXISTS idx_android_apps_owner   ON android_apps(owner_id);
CREATE INDEX IF NOT EXISTS idx_android_apps_status  ON android_apps(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_android_apps_package ON android_apps(package_name);

-- ---------------------------------------------------------------------
-- app_counter_shards  — sharded counters to absorb write hotspots.
-- Aggregated periodically into android_apps.* by a cron job.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_counter_shards (
  app_id     UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  shard_id   SMALLINT NOT NULL,             -- 0..63
  installs   BIGINT NOT NULL DEFAULT 0,
  uninstalls BIGINT NOT NULL DEFAULT 0,
  events     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, shard_id)
);

-- ---------------------------------------------------------------------
-- app_devices  — one row per (app_id, install). NOT partitioned because
-- it's a lookup table; row count = active install base, not events.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_devices (
  device_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,

  -- The SDK-generated stable identifier. Hashed before storage so we
  -- never hold raw ANDROID_ID/ad-id alongside FCM tokens.
  install_hash     BYTEA NOT NULL,          -- sha256(android_id + app_id)

  manufacturer     TEXT,
  model            TEXT,
  os_version       TEXT,
  sdk_int          SMALLINT,
  app_version      TEXT,
  app_build        INTEGER,
  language         CHAR(2),
  timezone         TEXT,
  country_code     CHAR(2),
  carrier          TEXT,
  network_type     TEXT CHECK (network_type IN ('wifi','cellular','ethernet','unknown')),

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at   TIMESTAMPTZ,

  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (app_id, install_hash)
);

-- Hash index → O(1) lookup on the SDK's primary path (init by install_hash).
CREATE INDEX IF NOT EXISTS idx_app_devices_install_hash
  ON app_devices USING hash (install_hash);

CREATE INDEX IF NOT EXISTS idx_app_devices_app_active
  ON app_devices(app_id, last_seen_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_app_devices_app_country
  ON app_devices(app_id, country_code)
  WHERE is_active = TRUE;

-- BRIN on first_seen_at — write-cheap, perfect for cohort queries.
CREATE INDEX IF NOT EXISTS brin_app_devices_first_seen
  ON app_devices USING brin (first_seen_at) WITH (pages_per_range = 64);

-- ---------------------------------------------------------------------
-- app_subscribers  — FCM tokens. One device may rotate tokens over time;
-- we keep the latest valid one per device.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_subscribers (
  subscriber_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  device_id        UUID NOT NULL REFERENCES app_devices(device_id) ON DELETE CASCADE,

  fcm_token        TEXT NOT NULL,
  -- Generated hash → unique identity, indexable cheaply, hides raw token from indexes.
  token_hash       BYTEA GENERATED ALWAYS AS (digest(fcm_token, 'sha256')) STORED,

  is_valid         BOOLEAN NOT NULL DEFAULT TRUE,
  invalid_reason   TEXT,                    -- 'unregistered','invalid_argument', etc.
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (app_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_app_subscribers_device
  ON app_subscribers(device_id);

CREATE INDEX IF NOT EXISTS idx_app_subscribers_app_valid
  ON app_subscribers(app_id)
  WHERE is_valid = TRUE;

-- ---------------------------------------------------------------------
-- app_push_notifications  — campaigns.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_push_notifications (
  notification_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id            UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,

  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  image_url         TEXT,
  click_action_url  TEXT,
  data_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Targeting.
  target_type       TEXT NOT NULL DEFAULT 'all'
                      CHECK (target_type IN ('all','active','country','segment','device_list')),
  target_countries  TEXT[],                 -- ISO-2 codes for 'country' targeting
  target_segment_id UUID,
  target_device_ids UUID[],
  active_window_min INTEGER DEFAULT 1440,   -- "active" = last_seen within N minutes

  -- Pipeline state.
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','queued','dispatching','sent','failed','cancelled')),
  scheduled_at      TIMESTAMPTZ,
  dispatched_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,

  -- Pre-aggregated stats (final values; per-message rows live in app_message_delivery).
  recipients_count  BIGINT NOT NULL DEFAULT 0,
  sent_count        BIGINT NOT NULL DEFAULT 0,
  delivered_count   BIGINT NOT NULL DEFAULT 0,
  opened_count      BIGINT NOT NULL DEFAULT 0,
  clicked_count     BIGINT NOT NULL DEFAULT 0,
  failed_count      BIGINT NOT NULL DEFAULT 0,

  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notif_app_status
  ON app_push_notifications(app_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notif_scheduled
  ON app_push_notifications(scheduled_at)
  WHERE status = 'queued' AND scheduled_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- apk_builds  — APK builder pipeline. Low write volume, no partitioning.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apk_builds (
  build_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  version_name    TEXT NOT NULL,
  version_code    INTEGER NOT NULL,
  build_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (build_status IN ('pending','building','succeeded','failed','cancelled')),
  build_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  apk_url         TEXT,
  apk_size_bytes  BIGINT,
  apk_sha256      TEXT,
  build_log_url   TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  UNIQUE (app_id, version_code)
);

CREATE INDEX IF NOT EXISTS idx_apk_builds_app_status
  ON apk_builds(app_id, build_status, created_at DESC);

-- ---------------------------------------------------------------------
-- API key registry — for /push/send and any future server-to-server APIs.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  key_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES app_owners(owner_id) ON DELETE CASCADE,
  app_id          UUID REFERENCES android_apps(app_id) ON DELETE CASCADE,
  key_hash        BYTEA NOT NULL UNIQUE,    -- sha256 of the actual key
  key_prefix      TEXT NOT NULL,            -- first 8 chars, for display ("sk_live_a1b2...")
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['push:send']::TEXT[],
  rate_limit_rpm  INTEGER NOT NULL DEFAULT 600,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------
-- Rate limit bucket store — token-bucket per (key, minute).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key   TEXT NOT NULL,                -- e.g. 'app:<uuid>:init', 'apikey:<uuid>'
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

-- BRIN: this table is purged frequently; we don't need precise btree.
CREATE INDEX IF NOT EXISTS brin_rate_limit_window
  ON rate_limit_buckets USING brin (window_start);

COMMENT ON TABLE rate_limit_buckets IS
  'Per-window counters. Rows older than 1h are reaped by cron.';
