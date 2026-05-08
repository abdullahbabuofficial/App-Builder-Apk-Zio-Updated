-- scripts/setup-cron.sql
-- Idempotent registration of the six cron jobs from
-- `backends/deployment.md` §2 ("Schedule the cron jobs").
--
-- Safe to run multiple times: each job is created only when no row exists
-- in cron.job with the same jobname. If a job is already present, this
-- script leaves it untouched (no schedule overwrite, no duplicate row).
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/setup-cron.sql
--
-- Prerequisites:
--   * pg_cron extension enabled (the migration enables it; the Supabase
--     UI toggle works too).
--   * `DATABASE_URL` points at the direct (non-pooler, port 5432)
--     Postgres connection string.

DO $cron$
DECLARE
  job RECORD;
BEGIN
  FOR job IN
    SELECT *
    FROM (
      VALUES
        (
          'pc_refresh_live',
          '* * * * *',
          'refresh materialized view concurrently mv_app_live_users'
        ),
        (
          'pc_aggregate_counters',
          '* * * * *',
          'select aggregate_app_counters()'
        ),
        (
          'pc_reap_ratelimit',
          '*/15 * * * *',
          'select reap_rate_limit_buckets()'
        ),
        (
          'pc_roll_partitions',
          '0 3 1 * *',
          'select roll_partitions_forward()'
        ),
        (
          'pc_daily_stats',
          '15 0 * * *',
          'select compute_daily_stats((current_date - 1))'
        ),
        (
          'pc_dormant_devices',
          '30 4 * * *',
          'select sweep_dormant_devices()'
        )
    ) AS t(jobname, schedule, command)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = job.jobname
    ) THEN
      PERFORM cron.schedule(job.jobname, job.schedule, job.command);
      RAISE NOTICE 'scheduled %', job.jobname;
    ELSE
      RAISE NOTICE 'skip % (already scheduled)', job.jobname;
    END IF;
  END LOOP;
END
$cron$;

-- Verification query for operators (no-op when piped via `psql -f`; uncomment
-- if you want the report inline):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'pc_%';
