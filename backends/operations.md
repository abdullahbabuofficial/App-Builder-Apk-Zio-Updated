# ApkZio — Operations & Runbook

How to keep ApkZio healthy at millions-of-devices scale, what to monitor, and what to do when something is on fire.

---

## 1. Capacity model

Rough numbers per Postgres `xlarge` (8 vCPU / 32 GB) and a single dispatcher pod (2 vCPU / 1 GB):

| Workload | Sustained per pod / instance | Notes |
|---|---|---|
| `/sdk/heartbeat` | ≥ 15k req/s | INSERT into a partition + conditional UPDATE; nothing fancier. |
| `/sdk/init` | ≥ 4k req/s | Includes counter-shard increment and subscriber upsert. |
| `/sdk/event` | ≥ 8k events/s | Batches up to 100 per call; cost is dominated by JSON validation. |
| FCM dispatch | ≥ 1.5M deliveries / min / pod | `sendEachForMulticast` with batches of 500 and concurrency 6. |

Scale-out rules of thumb:

- **Database CPU** is the first thing to climb. The cheap fix is the **Supabase connection pooler** — set `PG_POOL_MAX=5` per dispatcher pod and let pgBouncer fan out.
- **Edge Functions** scale automatically; you do not need to do anything.
- **Dispatcher pods**: one is enough up to ~1M devices; add a second once heartbeat-driven write IO crosses ~30%.

---

## 2. Dashboards — what to graph

Build these panels (Grafana / Supabase Studio / Datadog — anything that talks to Postgres + your container logs).

### Postgres

- `xact_commit / s` and `tup_inserted / s` for `app_heartbeats`, `app_analytics_events`, `app_message_delivery`. Sudden drop = SDK or edge function regression. Sudden spike = a runaway client; check `/sdk/event` rate-limit hit rate.
- **Bloat & dead tuples** on `app_devices` and `app_subscribers`. These are the only hot UPDATE targets. If `n_dead_tup` > 10% of `n_live_tup`, autovacuum is falling behind — either tune `autovacuum_vacuum_scale_factor` to 0.05 or add a manual `VACUUM ANALYZE` cron during a quiet hour.
- **Replication lag** if you've enabled read replicas (Supabase Team plan). A sustained lag > 30s means the dispatcher should fall back to the primary.
- **Slowest statements** from `pg_stat_statements` — re-check weekly. Anything outside the top 10 RPCs is a regression.

### Edge functions

- Per-function p50, p95, p99 latency. Targets:
  - `sdk-heartbeat`: p50 ≤ 25 ms, p99 ≤ 100 ms
  - `sdk-init`: p50 ≤ 40 ms, p99 ≤ 150 ms
  - `push-send`: p50 ≤ 50 ms (it just enqueues)
- Error rate per function. Anything above 0.5% sustained needs investigation.
- `429` rate vs total — a creeping `429` rate is usually a misbehaving SDK build.

### Dispatcher

- **Inflight notifications** (from `/healthz`).
- **Campaign latency**: time from `created_at` → `sent_at` on `app_push_notifications`. SLO: p95 ≤ 60s for `target.type=active`, p95 ≤ 5min for `all`.
- **Permanent FCM errors** per minute. A spike correlates with a bad APK release rotating out installs en masse — usually self-healing.
- **Queue depth**: `select count(*) from app_push_notifications where status in ('queued','dispatching')` — if this grows monotonically, scale dispatcher pods.

---

## 3. Routine maintenance

Already automated by `pg_cron` (see `005_views_and_cron.sql`). Verify they run:

```sql
select jobname, last_run_at, last_run_status
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'pc_%'
order by last_run_at desc limit 20;
```

| Job | Cadence | What it does | When to worry |
|---|---|---|---|
| `pc_refresh_live` | every 1 min | refresh `mv_app_live_users` | duration > 10s |
| `pc_aggregate_counters` | every 1 min | fold `app_counter_shards` into `android_apps` totals | duration > 5s |
| `pc_reap_ratelimit` | every 15 min | drop expired buckets | row delete count = 0 → bucket TTL is wrong |
| `pc_roll_partitions` | monthly, day 1 03:00 | create next-month partitions for the 3 partitioned tables | failure → writes go into the default partition; not fatal but creates bloat |
| `pc_daily_stats` | daily 00:15 | compute previous-day rollups into `app_daily_stats` | failure → `/apps/stats?range=…` returns yesterday's row missing |
| `pc_dormant_devices` | daily 04:30 | mark `is_active=false` on 30+ day silent devices | duration > 5 min — index missing, run `\d+ app_devices` |

### When you need to add partitions manually

```sql
select create_monthly_partition('app_heartbeats',        date_trunc('month', now())::date + interval '7 months');
select create_monthly_partition('app_analytics_events',  date_trunc('month', now())::date + interval '7 months');
select create_monthly_partition('app_message_delivery',  date_trunc('month', now())::date + interval '7 months');
```

### Cold storage

After 90 days, heartbeats and events are usually only useful in aggregate (already in `app_daily_stats`). Detach the old partition and ship it to S3 / GCS:

```sql
alter table app_heartbeats detach partition app_heartbeats_2025_11 concurrently;
-- pg_dump just that partition, upload, then:
drop table app_heartbeats_2025_11;
```

The detached partition keeps its indexes and is queryable as a normal table while you back it up.

---

## 4. Runbook — common incidents

### A) Heartbeat latency spiked over 200ms p99

1. Check `pg_stat_activity` for a long-running `VACUUM` or migration.
2. If the partitioned table for the current month is bigger than ~100M rows, `pc_roll_partitions` may have failed last month — check `cron.job_run_details`.
3. If autovacuum is behind on `app_devices`, the conditional UPDATE in `sdk_record_heartbeat` is blocking. Run:
   ```sql
   vacuum (verbose, analyze) app_devices;
   ```
4. Last resort: temporarily increase the heartbeat dampening from 25s to 60s in `003_functions.sql` and redeploy.

### B) Pushes are queuing up — `status='queued'` count is climbing

1. `curl https://<dispatcher>/healthz` — is `inflight` already at `WORKER_CONCURRENCY`? If yes, scale.
2. Check dispatcher logs for `claim_notification` skips. The query uses `FOR UPDATE SKIP LOCKED`, so it should never block, but a dead pod holding a row lock will. Find and kill orphan transactions:
   ```sql
   select pid, age(clock_timestamp(), xact_start), query
   from pg_stat_activity where state = 'idle in transaction' and xact_start < now() - interval '5 min';
   ```
3. If the queue is real (lots of legitimate work), bump `WORKER_CONCURRENCY` env var or scale pods. Each pod can comfortably push ~25k FCM messages/sec.

### C) `messaging/registration-token-not-registered` errors flood in

This is normal background churn. The dispatcher already marks affected subscribers `is_valid=false` via `push_record_delivery_batch`. Worry only if **all** tokens for a single app are failing — likely the FCM service-account JSON in `android_apps.fcm_credentials` is for the wrong project.

```sql
select count(*) filter (where is_valid)         as valid,
       count(*) filter (where not is_valid)     as invalid
from app_subscribers where app_id = '<uuid>';
```

A healthy app sees ~5-10% invalid subscribers at any time.

### D) `mv_app_live_users` is stale

The materialized view refreshes once a minute. If the cron job is failing:

```sql
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname='pc_refresh_live')
order by start_time desc limit 5;
```

A common cause is contention with autovacuum on `app_heartbeats`. Run a manual `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_app_live_users` once and check the `runtime` column. If it grew above 30s, the matview filter (`occurred_at >= now() - interval '24 hours'`) is hitting a partition that needs `ANALYZE`.

### E) Service key leaked

```sql
update api_keys set is_active = false
where name = '<the-leaked-key-name>';
```

Then issue a new key (see `deployment.md §4`) and rotate the consumer. Hashed storage means the leaked key is **not** recoverable from your DB — only the holder of the plaintext can use it, so disabling the row is enough.

### F) Suspected abuse from a single IP

The rate-limiter already throttles per-`(app_key, ip)` for `/sdk/init`. To force-block:

```sql
insert into rate_limit_buckets (bucket_key, window_start, count)
values ('blocklist:ip:<offending-ip>', now() + interval '1 day', 999999)
on conflict (bucket_key, window_start) do update set count = excluded.count;
```

The edge function checks this prefix before any work. Remove with `delete from rate_limit_buckets where bucket_key = 'blocklist:ip:…'`.

---

## 5. Index hygiene

Quarterly review:

```sql
-- unused indexes
select schemaname||'.'||relname as table, indexrelname,
       idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where idx_scan = 0 and indexrelname not like '%_pkey'
order by pg_relation_size(indexrelid) desc;

-- duplicate-ish indexes
select indrelid::regclass, array_agg(indexrelid::regclass)
from pg_index group by indrelid, indkey having count(*) > 1;
```

Drop or merge anything large with zero scans. **Exception:** the partial index on `app_message_delivery (fcm_message_id) where fcm_message_id is not null` exists for support-debugging lookups — keep it even if `idx_scan` is low.

---

## 6. Alerting (suggested PagerDuty-grade)

| Alert | Threshold | Severity |
|---|---|---|
| `sdk-heartbeat` p99 > 250ms for 5 min | latency | page |
| Edge function 5xx rate > 1% for 5 min | errors | page |
| `queued` notifications > 10 minutes old | queue health | page |
| Dispatcher pod restarts > 3 / 10 min | crashloop | page |
| Postgres CPU > 80% for 15 min | DB pressure | warn |
| `mv_app_live_users` last refresh > 5 min ago | freshness | warn |
| Daily stats job failed | reporting | warn (next morning) |

---

## 7. Cost levers (in order of impact)

1. **Detach old partitions** — heartbeats older than 90 days dominate storage.
2. **Sample heartbeats** for very large apps — keep 1 in N rows, set `last_seen_at` directly. The matview only needs presence, not count.
3. **Trim `event_params`** server-side — reject >1KB JSON for high-volume event names.
4. **Pooler over direct connections** — switch the dispatcher to `port=6543` (transaction pooler) to drop active backend count.
5. **Per-tenant FCM credentials cache TTL** — already 6h, can drop to 2h if you serve thousands of tenants on one pod.
