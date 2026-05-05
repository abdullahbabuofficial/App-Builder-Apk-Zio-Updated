-- =====================================================================
-- PushCare :: 005_views_and_cron.sql
-- Materialized views for stats endpoints + pg_cron schedules.
--
-- Strategy: refresh hourly views CONCURRENTLY so they never block
-- reads. Daily aggregates roll up into a permanent rollup table that
-- backs the dashboard.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Daily rollup (permanent, append-mostly).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_daily_stats (
  app_id           UUID NOT NULL REFERENCES android_apps(app_id) ON DELETE CASCADE,
  stat_date        DATE NOT NULL,
  new_installs     BIGINT NOT NULL DEFAULT 0,
  active_devices   BIGINT NOT NULL DEFAULT 0,
  total_events     BIGINT NOT NULL DEFAULT 0,
  total_sessions   BIGINT NOT NULL DEFAULT 0,
  push_sent        BIGINT NOT NULL DEFAULT 0,
  push_delivered   BIGINT NOT NULL DEFAULT 0,
  push_opened      BIGINT NOT NULL DEFAULT 0,
  push_clicked     BIGINT NOT NULL DEFAULT 0,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (app_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_app_daily_stats_date
  ON app_daily_stats (stat_date DESC);

-- ---------------------------------------------------------------------
-- Hourly DAU sketch (refreshed every 5 min).
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_app_live_users AS
SELECT
  app_id,
  count(DISTINCT device_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '5 minutes')   AS live_5m,
  count(DISTINCT device_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '1 hour')      AS active_1h,
  count(DISTINCT device_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours')    AS active_24h
FROM app_heartbeats
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY app_id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mv_live_app ON mv_app_live_users(app_id);

-- ---------------------------------------------------------------------
-- Compute yesterday's daily stats for every app.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_daily_stats(p_target_date DATE DEFAULT (NOW() - INTERVAL '1 day')::DATE)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO app_daily_stats (
    app_id, stat_date,
    new_installs, active_devices, total_events, total_sessions,
    push_sent, push_delivered, push_opened, push_clicked
  )
  SELECT
    a.app_id,
    p_target_date,
    COALESCE(ni.cnt, 0),
    COALESCE(ad.cnt, 0),
    COALESCE(ev.cnt, 0),
    COALESCE(ev.sessions, 0),
    COALESCE(p.sent, 0),
    COALESCE(p.delivered, 0),
    COALESCE(p.opened, 0),
    COALESCE(p.clicked, 0)
  FROM android_apps a
  LEFT JOIN (
    SELECT app_id, count(*) AS cnt
      FROM app_devices
     WHERE first_seen_at >= p_target_date
       AND first_seen_at <  p_target_date + 1
     GROUP BY app_id
  ) ni ON ni.app_id = a.app_id
  LEFT JOIN (
    SELECT app_id, count(DISTINCT device_id) AS cnt
      FROM app_heartbeats
     WHERE occurred_at >= p_target_date
       AND occurred_at <  p_target_date + 1
     GROUP BY app_id
  ) ad ON ad.app_id = a.app_id
  LEFT JOIN (
    SELECT app_id,
           count(*)                     AS cnt,
           count(DISTINCT session_id)   AS sessions
      FROM app_analytics_events
     WHERE occurred_at >= p_target_date
       AND occurred_at <  p_target_date + 1
     GROUP BY app_id
  ) ev ON ev.app_id = a.app_id
  LEFT JOIN (
    SELECT app_id,
           count(*) FILTER (WHERE status >= 1)               AS sent,
           count(*) FILTER (WHERE delivered_at IS NOT NULL)  AS delivered,
           count(*) FILTER (WHERE opened_at    IS NOT NULL)  AS opened,
           count(*) FILTER (WHERE clicked_at   IS NOT NULL)  AS clicked
      FROM app_message_delivery
     WHERE sent_at >= p_target_date
       AND sent_at <  p_target_date + 1
     GROUP BY app_id
  ) p ON p.app_id = a.app_id
  ON CONFLICT (app_id, stat_date) DO UPDATE
    SET new_installs   = EXCLUDED.new_installs,
        active_devices = EXCLUDED.active_devices,
        total_events   = EXCLUDED.total_events,
        total_sessions = EXCLUDED.total_sessions,
        push_sent      = EXCLUDED.push_sent,
        push_delivered = EXCLUDED.push_delivered,
        push_opened    = EXCLUDED.push_opened,
        push_clicked   = EXCLUDED.push_clicked,
        computed_at    = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------
-- Mark devices that haven't been seen in 30 days as inactive.
-- (Distinct from "uninstalled", which is set when FCM returns
--  UNREGISTERED on a push.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sweep_dormant_devices() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE app_devices
     SET is_active = FALSE
   WHERE is_active = TRUE
     AND last_seen_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------
-- pg_cron schedule (set up after enabling extension).
-- Run these manually after deploy:
--
--   SELECT cron.schedule('refresh_live', '*/1 * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_app_live_users');
--   SELECT cron.schedule('aggregate_counters', '*/1 * * * *',
--     'SELECT aggregate_app_counters()');
--   SELECT cron.schedule('reap_ratelimit', '*/15 * * * *',
--     'SELECT reap_rate_limit_buckets()');
--   SELECT cron.schedule('roll_partitions', '0 3 1 * *',
--     'SELECT roll_partitions_forward()');
--   SELECT cron.schedule('daily_stats', '15 0 * * *',
--     'SELECT compute_daily_stats()');
--   SELECT cron.schedule('dormant_devices', '30 4 * * *',
--     'SELECT sweep_dormant_devices()');
-- ---------------------------------------------------------------------

ALTER TABLE app_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_stats_owner ON app_daily_stats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM android_apps a
     WHERE a.app_id = app_daily_stats.app_id
       AND a.owner_id = current_owner_id()
  ));
