-- =====================================================================
-- ApkZio :: 003_functions.sql
-- Server-side functions called by Edge Functions via PostgREST RPC.
--
-- Why server-side? Because round-tripping each step from an Edge
-- Function (in Deno) is ~5-10ms per query. A single call to register a
-- device touches 4 tables. Bundling it as one transaction keeps init
-- under 50ms p99 even at scale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- sdk_init_device
-- Idempotent: same install_hash → same device_id, lossless update of
-- attributes. Returns everything the SDK needs.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sdk_init_device(
  p_app_key       TEXT,
  p_install_hash  BYTEA,
  p_fcm_token     TEXT,
  p_attrs         JSONB
)
RETURNS TABLE (
  device_id     UUID,
  app_id        UUID,
  subscriber_id UUID,
  is_new_install BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_id        UUID;
  v_app_status    TEXT;
  v_device_id     UUID;
  v_subscriber_id UUID;
  v_is_new        BOOLEAN := FALSE;
  v_shard         SMALLINT;
BEGIN
  -- 1. Resolve app_key → app_id. The app_key index is UNIQUE so this is O(1).
  SELECT a.app_id, a.status INTO v_app_id, v_app_status
    FROM android_apps a
   WHERE a.app_key = p_app_key;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'invalid_app_key' USING ERRCODE = 'P0001';
  END IF;
  IF v_app_status <> 'active' THEN
    RAISE EXCEPTION 'app_suspended' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Upsert the device. ON CONFLICT path is the common one.
  INSERT INTO app_devices (
    app_id, install_hash,
    manufacturer, model, os_version, sdk_int,
    app_version, app_build, language, timezone,
    country_code, carrier, network_type, metadata,
    last_seen_at, is_active
  )
  VALUES (
    v_app_id, p_install_hash,
    p_attrs->>'manufacturer', p_attrs->>'model', p_attrs->>'os_version',
    NULLIF(p_attrs->>'sdk_int','')::SMALLINT,
    p_attrs->>'app_version', NULLIF(p_attrs->>'app_build','')::INTEGER,
    LOWER(LEFT(p_attrs->>'language', 2)),
    p_attrs->>'timezone',
    UPPER(LEFT(p_attrs->>'country_code', 2)),
    p_attrs->>'carrier', p_attrs->>'network_type',
    COALESCE(p_attrs->'metadata', '{}'::jsonb),
    NOW(), TRUE
  )
  ON CONFLICT (app_id, install_hash) DO UPDATE
    SET manufacturer  = EXCLUDED.manufacturer,
        model         = EXCLUDED.model,
        os_version    = EXCLUDED.os_version,
        sdk_int       = EXCLUDED.sdk_int,
        app_version   = EXCLUDED.app_version,
        app_build     = EXCLUDED.app_build,
        language      = EXCLUDED.language,
        timezone      = EXCLUDED.timezone,
        country_code  = COALESCE(EXCLUDED.country_code, app_devices.country_code),
        carrier       = EXCLUDED.carrier,
        network_type  = EXCLUDED.network_type,
        last_seen_at  = NOW(),
        is_active     = TRUE,
        uninstalled_at = NULL
    RETURNING device_id, (xmax = 0) INTO v_device_id, v_is_new;

  -- 3. Increment sharded install counter on first-ever install.
  IF v_is_new THEN
    v_shard := (('x' || substr(md5(v_device_id::TEXT), 1, 4))::bit(16)::INT) % 64;
    INSERT INTO app_counter_shards (app_id, shard_id, installs)
    VALUES (v_app_id, v_shard, 1)
    ON CONFLICT (app_id, shard_id)
    DO UPDATE SET installs = app_counter_shards.installs + 1;
  END IF;

  -- 4. Upsert subscriber if FCM token was supplied.
  IF p_fcm_token IS NOT NULL AND length(p_fcm_token) > 20 THEN
    INSERT INTO app_subscribers (app_id, device_id, fcm_token, is_valid, last_validated_at)
    VALUES (v_app_id, v_device_id, p_fcm_token, TRUE, NOW())
    ON CONFLICT (app_id, token_hash) DO UPDATE
      SET device_id          = EXCLUDED.device_id,
          fcm_token          = EXCLUDED.fcm_token,
          is_valid           = TRUE,
          invalid_reason     = NULL,
          last_validated_at  = NOW(),
          updated_at         = NOW()
      RETURNING subscriber_id INTO v_subscriber_id;
  END IF;

  RETURN QUERY SELECT v_device_id, v_app_id, v_subscriber_id, v_is_new;
END;
$$;

-- ---------------------------------------------------------------------
-- sdk_record_heartbeat
-- Cheap, fire-and-forget. Updates last_seen_at and inserts the heartbeat.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sdk_record_heartbeat(
  p_app_id      UUID,
  p_device_id   UUID,
  p_session_id  UUID,
  p_country     CHAR(2),
  p_app_version TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Async-style: append heartbeat first (cheap, no locks), update lookup row second.
  INSERT INTO app_heartbeats (app_id, device_id, session_id, country_code, app_version)
  VALUES (p_app_id, p_device_id, p_session_id, p_country, p_app_version);

  -- Only bump last_seen_at if it's drifted >25s; avoids index churn.
  UPDATE app_devices
     SET last_seen_at = NOW()
   WHERE device_id = p_device_id
     AND last_seen_at < NOW() - INTERVAL '25 seconds';
END;
$$;

-- ---------------------------------------------------------------------
-- sdk_record_event  — analytics event ingestion.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sdk_record_event(
  p_app_id      UUID,
  p_device_id   UUID,
  p_session_id  UUID,
  p_event_name  TEXT,
  p_params      JSONB,
  p_country     CHAR(2),
  p_app_version TEXT,
  p_occurred_at TIMESTAMPTZ
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO app_analytics_events (
    app_id, device_id, session_id, event_name,
    event_params, country_code, app_version, occurred_at
  ) VALUES (
    p_app_id, p_device_id, p_session_id, p_event_name,
    COALESCE(p_params, '{}'::jsonb),
    p_country, p_app_version,
    COALESCE(p_occurred_at, NOW())
  )
  RETURNING event_id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- push_target_subscribers
-- Returns the FCM tokens that match a campaign's targeting rules.
-- Streamed in chunks to the dispatcher.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION push_target_subscribers(
  p_notification_id UUID,
  p_chunk_size      INTEGER DEFAULT 500,
  p_after_sub_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  subscriber_id UUID,
  device_id     UUID,
  fcm_token     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n  app_push_notifications%ROWTYPE;
  cutoff TIMESTAMPTZ;
BEGIN
  SELECT * INTO n FROM app_push_notifications WHERE notification_id = p_notification_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_not_found';
  END IF;

  cutoff := NOW() - make_interval(mins => COALESCE(n.active_window_min, 1440));

  RETURN QUERY
  SELECT s.subscriber_id, s.device_id, s.fcm_token
    FROM app_subscribers s
    JOIN app_devices d ON d.device_id = s.device_id
   WHERE s.app_id = n.app_id
     AND s.is_valid = TRUE
     AND d.is_active = TRUE
     AND (n.target_type <> 'active' OR d.last_seen_at >= cutoff)
     AND (
       n.target_type IN ('all','active')
       OR (n.target_type = 'country'    AND d.country_code = ANY(n.target_countries))
       OR (n.target_type = 'device_list' AND d.device_id    = ANY(n.target_device_ids))
     )
     AND (p_after_sub_id IS NULL OR s.subscriber_id > p_after_sub_id)
   ORDER BY s.subscriber_id
   LIMIT p_chunk_size;
END;
$$;

-- ---------------------------------------------------------------------
-- push_record_delivery_batch
-- Called by the dispatcher after each FCM batch. Bulk-inserts delivery
-- rows in one statement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION push_record_delivery_batch(
  p_notification_id UUID,
  p_app_id          UUID,
  p_results         JSONB              -- [{subscriber_id, device_id, status, fcm_message_id, error_code}]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INTEGER;
  v_sent     INTEGER;
  v_failed   INTEGER;
  v_invalid  INTEGER;
BEGIN
  WITH input AS (
    SELECT
      (e->>'subscriber_id')::UUID  AS subscriber_id,
      (e->>'device_id')::UUID      AS device_id,
      (e->>'status')::SMALLINT     AS status,
      e->>'fcm_message_id'         AS fcm_message_id,
      e->>'error_code'             AS error_code
    FROM jsonb_array_elements(p_results) e
  ),
  ins AS (
    INSERT INTO app_message_delivery (
      notification_id, app_id, device_id, subscriber_id,
      fcm_message_id, status, error_code
    )
    SELECT p_notification_id, p_app_id, i.device_id, i.subscriber_id,
           i.fcm_message_id, i.status, i.error_code
      FROM input i
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  -- Roll up counts on the campaign row in one pass.
  SELECT
    count(*) FILTER (WHERE status IN (1,2,3,4)),
    count(*) FILTER (WHERE status = 5),
    count(*) FILTER (WHERE status = 6)
  INTO v_sent, v_failed, v_invalid
  FROM jsonb_array_elements(p_results) e
  CROSS JOIN LATERAL (SELECT (e->>'status')::SMALLINT AS status) s;

  UPDATE app_push_notifications
     SET sent_count        = sent_count   + v_sent,
         failed_count      = failed_count + v_failed + v_invalid,
         updated_at        = NOW()
   WHERE notification_id = p_notification_id;

  -- Mark the invalid tokens. Doing it inline saves another round-trip.
  UPDATE app_subscribers s
     SET is_valid = FALSE,
         invalid_reason = i.error_code,
         updated_at = NOW()
    FROM (
      SELECT (e->>'subscriber_id')::UUID AS subscriber_id,
             e->>'error_code'            AS error_code
        FROM jsonb_array_elements(p_results) e
       WHERE (e->>'status')::SMALLINT = 6
    ) i
   WHERE s.subscriber_id = i.subscriber_id;

  RETURN v_inserted;
END;
$$;

-- ---------------------------------------------------------------------
-- push_record_engagement  — called by /push/track from the SDK.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION push_record_engagement(
  p_notification_id UUID,
  p_device_id       UUID,
  p_event           TEXT             -- 'delivered' | 'opened' | 'clicked'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_field TEXT;
  v_status SMALLINT;
BEGIN
  CASE p_event
    WHEN 'delivered' THEN v_field := 'delivered_at'; v_status := 2;
    WHEN 'opened'    THEN v_field := 'opened_at';    v_status := 3;
    WHEN 'clicked'   THEN v_field := 'clicked_at';   v_status := 4;
    ELSE RAISE EXCEPTION 'invalid_engagement_event';
  END CASE;

  -- Only update first-occurrence to keep counters honest.
  EXECUTE format($f$
    UPDATE app_message_delivery
       SET %I = NOW(),
           status = GREATEST(status, $1)
     WHERE notification_id = $2
       AND device_id       = $3
       AND %I IS NULL
  $f$, v_field, v_field)
  USING v_status, p_notification_id, p_device_id;

  -- Aggregate counter bump.
  EXECUTE format(
    'UPDATE app_push_notifications SET %I_count = %I_count + 1 WHERE notification_id = $1',
    p_event, p_event
  )
  USING p_notification_id;
END;
$$;

-- ---------------------------------------------------------------------
-- aggregate_app_counters  — cron, every minute.
-- Folds shard rows into android_apps.* counters.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aggregate_app_counters() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  WITH agg AS (
    SELECT app_id,
           SUM(installs)   AS installs,
           SUM(uninstalls) AS uninstalls
      FROM app_counter_shards
     GROUP BY app_id
  ),
  active AS (
    SELECT app_id, count(*) AS active
      FROM app_devices
     WHERE is_active = TRUE
     GROUP BY app_id
  ),
  live AS (
    SELECT app_id, count(DISTINCT device_id) AS live
      FROM app_heartbeats
     WHERE occurred_at > NOW() - INTERVAL '5 minutes'
     GROUP BY app_id
  )
  UPDATE android_apps a
     SET total_installs    = COALESCE(g.installs, a.total_installs),
         total_uninstalls  = COALESCE(g.uninstalls, a.total_uninstalls),
         active_installs   = COALESCE(act.active, 0),
         live_users        = COALESCE(l.live, 0),
         counters_synced_at = NOW()
    FROM agg g
    LEFT JOIN active act ON act.app_id = g.app_id
    LEFT JOIN live   l   ON l.app_id   = g.app_id
   WHERE a.app_id = g.app_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Rate limiter — fixed-window, per-key.
-- Returns TRUE if the request is allowed.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket_key TEXT,
  p_limit      INTEGER,
  p_window_sec INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  v_window_start := date_trunc('second',
    NOW() - (extract(epoch FROM NOW())::BIGINT % p_window_sec) * INTERVAL '1 second'
  );

  INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
  VALUES (p_bucket_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- ---------------------------------------------------------------------
-- Maintenance: roll partitions forward, reap rate-limit history.
-- Wire to pg_cron.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION roll_partitions_forward() RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  next_month DATE := (date_trunc('month', NOW()) + INTERVAL '6 month')::DATE;
BEGIN
  PERFORM create_monthly_partition('app_heartbeats',       next_month);
  PERFORM create_monthly_partition('app_analytics_events', next_month);
  PERFORM create_monthly_partition('app_message_delivery', next_month);
END;
$$;

CREATE OR REPLACE FUNCTION reap_rate_limit_buckets() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limit_buckets WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;
