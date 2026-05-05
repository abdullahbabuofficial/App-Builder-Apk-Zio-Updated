#!/usr/bin/env bash
# deploy-supabase.sh — one-shot rollout of PushCare's Supabase tier.
#
# Wraps the steps from `backends/deployment.md` §1–4:
#   1. supabase link
#   2. supabase db push (apply migrations 001…005)
#   3. supabase functions deploy (one per Edge Function)
#   4. cron.schedule registration via psql
#
# Required env:
#   SUPABASE_PROJECT_REF  — your Supabase project ref (xxxx in xxxx.supabase.co)
#
# Optional env:
#   DATABASE_URL          — direct Postgres connection string. If set, the
#                           cron.schedule block runs; otherwise it is skipped
#                           with a warning so you can run it manually.
#   SUPABASE_ACCESS_TOKEN — set to skip interactive `supabase login`.
#
# Idempotent: re-running is safe. Migrations and function deploys are no-ops
# when nothing changed; cron.schedule is wrapped in `select … on conflict`.

set -euo pipefail

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Error: SUPABASE_PROJECT_REF is required (e.g. abcdwxyz)" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found in PATH. Install from https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

echo "[1/4] supabase link --project-ref ${SUPABASE_PROJECT_REF}"
supabase link --project-ref "${SUPABASE_PROJECT_REF}"

echo "[2/4] supabase db push"
supabase db push

echo "[3/4] Deploying Edge Functions"
SDK_FUNCTIONS=(
  sdk-init
  sdk-register-device
  sdk-heartbeat
  sdk-event
  push-track
  push-send
  signup-init
  webhook-deliver
  apk-build-trigger
  team-invite
)
for fn in "${SDK_FUNCTIONS[@]}"; do
  if [[ -d "supabase/functions/${fn}" ]]; then
    echo "  → ${fn} (--no-verify-jwt)"
    supabase functions deploy "${fn}" --no-verify-jwt
  else
    echo "  ↷ ${fn} (source folder not present, skipping)"
  fi
done
# apps-stats is the dashboard endpoint and *requires* JWT verification.
if [[ -d "supabase/functions/apps-stats" ]]; then
  echo "  → apps-stats (JWT verified)"
  supabase functions deploy apps-stats
fi

echo "[4/4] cron.schedule registration"
if [[ -n "${DATABASE_URL:-}" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "  ⚠ psql not found — skipping cron.schedule. Run the SQL block manually." >&2
  else
    psql "${DATABASE_URL}" <<'SQL'
      select cron.schedule('pc_refresh_live',             '* * * * *',     $$ refresh materialized view concurrently mv_app_live_users $$);
      select cron.schedule('pc_aggregate_counters',       '* * * * *',     $$ select aggregate_app_counters() $$);
      select cron.schedule('pc_reap_ratelimit',           '*/15 * * * *',  $$ select reap_rate_limit_buckets() $$);
      select cron.schedule('pc_roll_partitions',          '0 3 1 * *',     $$ select roll_partitions_forward() $$);
      select cron.schedule('pc_daily_stats',              '15 0 * * *',    $$ select compute_daily_stats((current_date - 1)) $$);
      select cron.schedule('pc_dormant_devices',          '30 4 * * *',    $$ select sweep_dormant_devices() $$);
      select cron.schedule('pc_roll_webhook_partitions',  '0 3 1 * *',     $$ select roll_webhook_partitions_forward() $$);
SQL
  fi
else
  echo "  ⚠ DATABASE_URL not set — skipping cron.schedule. Run it manually per backends/deployment.md §2." >&2
fi

echo
echo "Done."
echo "Smoke test:"
echo "  curl -X POST https://${SUPABASE_PROJECT_REF}.functions.supabase.co/sdk-heartbeat -H 'Content-Type: application/json' -d '{}'"
