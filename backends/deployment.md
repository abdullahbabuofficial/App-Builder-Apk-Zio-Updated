# PushCare — Deployment Guide

End-to-end recipe to bring up a production environment from scratch. Every step is idempotent unless noted.

## 0. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Supabase CLI | ≥ 1.190 | migrations + edge function deploys |
| Deno | ≥ 1.45 | edge functions runtime (bundled by CLI but sometimes useful locally) |
| Node | ≥ 20.10 | dispatcher service |
| Docker | ≥ 24 | dispatcher container build |
| `psql` | ≥ 15 | direct DB ops, partition rolls, post-deploy checks |
| GCP Service Account JSON | — | one per app (or one shared default) — used by `firebase-admin` |

You also need:

- A Supabase project (Pro plan or above for `pg_cron`, `pg_net`, point-in-time recovery, and dedicated CPU).
- A Firebase project per Android app (or a master project if you broker tokens centrally).
- A container host for the dispatcher: Cloud Run, Fly.io, Railway, ECS, or a small Kubernetes cluster.

---

## 1. Provision Supabase

1. Create the project. Pick a region close to your dispatcher (Singapore for South/SE Asia traffic).
2. Open **Project Settings → Database** and copy:
   - `Connection string (URI)` — the **direct** connection (port 5432), not the pooler.
   - `Service role key` — keep this in a secret manager.
   - `anon key` — needed for the dashboard.
3. Open **Database → Extensions** and enable:
   - `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `btree_gin`, `citext` (the migration enables these but the toggle in the UI is sometimes faster on shared hardware).
   - `pg_cron` — required for the maintenance jobs in `005_views_and_cron.sql`.

---

## 2. Apply migrations

From the repo root:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

`supabase db push` runs the five migration files in order:

```
001_core_schema.sql        – tenant tables, install hashes, sharded counters
002_partitioned_tables.sql – heartbeats / events / deliveries (RANGE by month)
003_functions.sql          – SECURITY DEFINER RPCs called by edge fns + worker
004_rls_policies.sql       – row-level security + redacted views
005_views_and_cron.sql     – daily rollups + maintenance jobs
```

Sanity check:

```bash
psql "$DATABASE_URL" -c "select count(*) from pg_partition_tree('app_heartbeats');"
psql "$DATABASE_URL" -c "select extname from pg_extension where extname in ('pgcrypto','pg_cron','pg_stat_statements');"
```

You should see ≥ 8 partitions (current + 6 future + default) and all three extensions.

### Schedule the cron jobs

The migration leaves the `cron.schedule` calls **commented out** so that re-running migrations doesn't double-schedule. Run these once after the first push:

```sql
select cron.schedule('pc_refresh_live',       '* * * * *',     $$ refresh materialized view concurrently mv_app_live_users $$);
select cron.schedule('pc_aggregate_counters', '* * * * *',     $$ select aggregate_app_counters() $$);
select cron.schedule('pc_reap_ratelimit',    '*/15 * * * *',   $$ select reap_rate_limit_buckets() $$);
select cron.schedule('pc_roll_partitions',   '0 3 1 * *',      $$ select roll_partitions_forward() $$);
select cron.schedule('pc_daily_stats',       '15 0 * * *',     $$ select compute_daily_stats((current_date - 1)) $$);
select cron.schedule('pc_dormant_devices',   '30 4 * * *',     $$ select sweep_dormant_devices() $$);
```

Verify:

```sql
select jobname, schedule, active from cron.job where jobname like 'pc_%';
```

---

## 3. Deploy edge functions

```bash
supabase functions deploy sdk-init             --no-verify-jwt
supabase functions deploy sdk-register-device  --no-verify-jwt
supabase functions deploy sdk-heartbeat        --no-verify-jwt
supabase functions deploy sdk-event            --no-verify-jwt
supabase functions deploy push-track           --no-verify-jwt
supabase functions deploy push-send            --no-verify-jwt
supabase functions deploy apps-stats
```

> The SDK functions use `--no-verify-jwt` because the Android SDK authenticates with `X-PC-App-Key`, not a Supabase JWT. `apps-stats` is the only one that **requires** a JWT — it relies on RLS for tenant isolation.

The functions inherit `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. No extra secrets are required for them.

---

## 4. Seed your first app

```sql
insert into app_owners (auth_user_id, email, display_name)
values ('<auth.users.id>', 'you@example.com', 'You')
returning id;

insert into android_apps (owner_id, name, package_name, status)
values ('<owner_id>', 'Acme', 'com.acme.app', 'active')
returning id, app_key;
-- copy app_key (pk_…) into your APK
```

Issue a service key for the dashboard / your backend:

```sql
-- generate locally: node -e "console.log('sk_live_'+require('crypto').randomBytes(24).toString('hex'))"
-- then store sha256(key) in api_keys.key_hash
insert into api_keys (app_id, name, key_hash, scopes, rate_limit_rpm)
values (
  '<app_id>',
  'dashboard',
  decode(encode(digest('sk_live_…the-key-you-generated…','sha256'),'hex'),'hex'),
  array['push:send','analytics:read'],
  1200
);
```

Keep the plaintext key in your secret manager — it is **not** recoverable from the database.

---

## 5. Deploy the dispatcher

```bash
cd firebase-service
cp .env.example .env
# fill in DATABASE_URL (direct connection), DEFAULT_FCM_CREDENTIALS (one-line JSON)
docker build -t pushcare/dispatcher:latest .
```

### Cloud Run example

```bash
gcloud run deploy pushcare-dispatcher \
  --image=gcr.io/<project>/pushcare-dispatcher:latest \
  --region=asia-southeast1 \
  --min-instances=2 \
  --max-instances=20 \
  --concurrency=1 \
  --cpu=2 --memory=1Gi \
  --port=8080 \
  --set-secrets=DATABASE_URL=pushcare-db-url:latest,DEFAULT_FCM_CREDENTIALS=pushcare-fcm:latest \
  --set-env-vars=WORKER_CONCURRENCY=4,POLL_INTERVAL_MS=2000,LOG_LEVEL=info
```

`--concurrency=1` is intentional: each container runs `WORKER_CONCURRENCY` async slots internally. Letting Cloud Run multiplex unrelated requests on top of that just inflates memory without helping throughput.

For multi-tenant deployments, store each app's service-account JSON in `android_apps.fcm_credentials`. The dispatcher's `fcm-client.ts` will lazily build a `FirebaseApp` per tenant and LRU-evict idle ones after 6 hours.

### Health check

```bash
curl https://<your-dispatcher>/healthz
# {"ok":true,"db":"ok","inflight":0,"uptime_sec":42}
```

---

## 6. Smoke test end-to-end

```bash
# 1. Init a fake device
curl -sX POST https://<ref>.functions.supabase.co/sdk-init \
  -H "X-PC-App-Key: pk_…" \
  -H "Content-Type: application/json" \
  -d '{"android_id":"deadbeef0001","fcm_token":"FAKE","country_code":"BD"}'

# 2. Send a test push
curl -sX POST https://<ref>.functions.supabase.co/push-send \
  -H "Authorization: Bearer sk_live_…" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id":"<uuid>",
    "title":"Hello",
    "body":"Smoke test",
    "target":{"type":"all"}
  }'

# 3. Watch the dispatcher logs — you should see
#    "claimed notification … recipients=1 sent=0 invalid=1"
#    (FCM rejects the FAKE token, so the subscriber is auto-marked invalid.)
```

---

## 7. Configure the Android SDK

The SDK only needs:

- `app_key` (`pk_…`) compiled into `BuildConfig` or read from `assets/pushcare.json`.
- `base_url` = `https://<ref>.functions.supabase.co`.

Recommended call sequence at app start:

```text
Application.onCreate
  → FirebaseMessaging.getToken()
  → POST /sdk/init with android_id + token
  → store device_id + app_id in SharedPreferences
  → schedule heartbeat WorkManager job (45s flex window)
```

On token rotation (`onNewToken`):

```text
POST /sdk/register-device { device_id, app_key, fcm_token }
```

On notification interaction:

```text
POST /push/track { notification_id, device_id, event: "opened"|"clicked" }
```

---

## 8. Rolling deploys & migrations

- **SQL migrations**: always additive. New columns get defaults; new tables don't break old code; partition rolls are forward-only. Never `DROP COLUMN` in a release that still has old edge functions deployed.
- **Edge functions**: deployments are atomic per-function. Old version drains in ~30s.
- **Dispatcher**: drains gracefully on `SIGTERM` (waits up to 25s for in-flight campaigns to finish, then `db.end()`). Cloud Run / k8s rolling updates are safe by default.

---

## 9. Backups & disaster recovery

- Supabase Pro gives you **7-day PITR** on the Postgres tier. Verify in **Project Settings → Database → Backups**.
- Daily logical dump of `app_owners`, `android_apps`, `api_keys`, and `app_daily_stats` is recommended for fast restore tests:
  ```bash
  pg_dump -t app_owners -t android_apps -t api_keys -t app_daily_stats \
    --data-only --column-inserts \
    "$DATABASE_URL" > "snapshots/$(date +%F).sql"
  ```
- Heartbeats and analytics events are **regenerable** from client retries; treat them as cold storage candidates after 90 days (see `operations.md`).
