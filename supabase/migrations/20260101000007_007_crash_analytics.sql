-- =====================================================================
-- ApkZio :: 007_crash_analytics.sql
-- Campaign errors tracking and crash analytics
-- =====================================================================

-- ---------------------------------------------------------------------
-- campaign_errors — Track FCM delivery errors per campaign
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_errors (
  error_id       BIGSERIAL PRIMARY KEY,
  campaign_id    UUID NOT NULL REFERENCES app_push_notifications(notification_id) ON DELETE CASCADE,
  error_code     TEXT NOT NULL,
  error_message  TEXT,
  subscriber_id  UUID REFERENCES app_subscribers(subscriber_id) ON DELETE SET NULL,
  device_info    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign 
  ON campaign_errors(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_errors_code 
  ON campaign_errors(error_code);

CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign_code 
  ON campaign_errors(campaign_id, error_code);

COMMENT ON TABLE campaign_errors IS
  'FCM delivery errors per campaign for debugging failed push notifications';

-- ---------------------------------------------------------------------
-- crash_events — Track app crashes from SDK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crash_events (
  crash_id       BIGSERIAL PRIMARY KEY,
  app_id         UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  device_id      TEXT,
  crash_type     TEXT NOT NULL,
  stack_trace    TEXT,
  app_version    TEXT,
  os_version     TEXT,
  manufacturer   TEXT,
  model          TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crashes_app_time 
  ON crash_events(app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crashes_type 
  ON crash_events(app_id, crash_type);

-- BRIN for time-based queries (crash trends)
CREATE INDEX IF NOT EXISTS brin_crashes_created 
  ON crash_events USING brin (created_at) WITH (pages_per_range = 64);

COMMENT ON TABLE crash_events IS
  'App crash events reported by SDK for crash rate analytics';
