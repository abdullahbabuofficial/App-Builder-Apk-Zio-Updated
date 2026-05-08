-- =====================================================================
-- ApkZio :: 002_partitioned_tables.sql
-- High-volume time-series tables: heartbeats, events, deliveries.
--
-- All three are RANGE-partitioned by month on `occurred_at`. This lets
-- us:
--   * Drop old partitions in O(1) (DETACH + DROP).
--   * Keep per-partition indexes small enough to fit in cache.
--   * Run VACUUM/ANALYZE per partition.
--
-- We pre-create 6 months of partitions; a cron job rolls forward.
-- =====================================================================

-- ---------------------------------------------------------------------
-- app_heartbeats  — fired every 30–60s while app is foregrounded.
--
-- We DO NOT FK to devices/apps here. At this volume the FK check costs
-- more than the integrity is worth. Orphans are trimmed by retention.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_heartbeats (
  heartbeat_id  BIGINT GENERATED ALWAYS AS IDENTITY,
  app_id        UUID NOT NULL,
  device_id     UUID NOT NULL,
  session_id    UUID,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country_code  CHAR(2),
  app_version   TEXT,
  PRIMARY KEY (occurred_at, heartbeat_id)
) PARTITION BY RANGE (occurred_at);

-- ---------------------------------------------------------------------
-- app_analytics_events
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_analytics_events (
  event_id      BIGINT GENERATED ALWAYS AS IDENTITY,
  app_id        UUID NOT NULL,
  device_id     UUID NOT NULL,
  session_id    UUID,
  event_name    TEXT NOT NULL,
  event_params  JSONB NOT NULL DEFAULT '{}'::jsonb,
  country_code  CHAR(2),
  app_version   TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (occurred_at, event_id)
) PARTITION BY RANGE (occurred_at);

-- ---------------------------------------------------------------------
-- app_message_delivery  — one row per (notification × subscriber).
-- Partitioned by sent_at because that's the natural query key.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_message_delivery (
  delivery_id     BIGINT GENERATED ALWAYS AS IDENTITY,
  notification_id UUID NOT NULL,
  app_id          UUID NOT NULL,
  device_id       UUID NOT NULL,
  subscriber_id   UUID NOT NULL,

  fcm_message_id  TEXT,                     -- ID returned by FCM
  status          SMALLINT NOT NULL DEFAULT 0,
  -- 0=queued 1=sent 2=delivered 3=opened 4=clicked 5=failed 6=token_invalid
  error_code      TEXT,
  retry_count     SMALLINT NOT NULL DEFAULT 0,

  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,

  PRIMARY KEY (sent_at, delivery_id)
) PARTITION BY RANGE (sent_at);

-- ---------------------------------------------------------------------
-- Helper: create a monthly partition for one of the partitioned tables.
-- Called by 003_functions.sql / a cron schedule.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_monthly_partition(
  parent_table TEXT,
  month_start  DATE
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  partition_name TEXT;
  range_start    TEXT;
  range_end      TEXT;
BEGIN
  partition_name := format('%s_%s', parent_table, to_char(month_start, 'YYYY_MM'));
  range_start    := month_start::TEXT;
  range_end      := (month_start + INTERVAL '1 month')::DATE::TEXT;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
       FOR VALUES FROM (%L) TO (%L)',
    partition_name, parent_table, range_start, range_end
  );

  -- Per-partition indexes. Defined here so every new partition gets them
  -- without relying on the planner to inherit from a global index.
  IF parent_table = 'app_heartbeats' THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (app_id, occurred_at DESC)',
      partition_name || '_app_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (device_id, occurred_at DESC)',
      partition_name || '_device_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I USING brin (occurred_at) WITH (pages_per_range = 32)',
      partition_name || '_brin_idx', partition_name
    );

  ELSIF parent_table = 'app_analytics_events' THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (app_id, event_name, occurred_at DESC)',
      partition_name || '_app_event_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (device_id, occurred_at DESC)',
      partition_name || '_device_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I USING gin (event_params jsonb_path_ops)',
      partition_name || '_params_gin', partition_name
    );

  ELSIF parent_table = 'app_message_delivery' THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (notification_id, status)',
      partition_name || '_notif_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (app_id, sent_at DESC)',
      partition_name || '_app_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (subscriber_id, sent_at DESC)',
      partition_name || '_sub_idx', partition_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (fcm_message_id) WHERE fcm_message_id IS NOT NULL',
      partition_name || '_fcm_idx', partition_name
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Provision partitions: previous month + current + next 6 months.
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
    PERFORM create_monthly_partition('app_heartbeats',       m);
    PERFORM create_monthly_partition('app_analytics_events', m);
    PERFORM create_monthly_partition('app_message_delivery', m);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- A "default" partition catches stray rows so inserts never fail. Cron
-- alerts if anything ends up here — usually means clock skew.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_heartbeats_default
  PARTITION OF app_heartbeats DEFAULT;
CREATE TABLE IF NOT EXISTS app_analytics_events_default
  PARTITION OF app_analytics_events DEFAULT;
CREATE TABLE IF NOT EXISTS app_message_delivery_default
  PARTITION OF app_message_delivery DEFAULT;
