# ApkZio — Architecture

A single-page tour of how SDK pings flow into Postgres, how campaigns reach
end devices, and which knobs scale as traffic patterns change.

## The big picture

```
                                   apkzio-admin (React)
                                        ▲ HTTPS + JWT
                                        │
                       ┌────────────────┴───────────────┐
                       │                                │
                       ▼                                ▼
        ┌──────────────────────────┐    ┌─────────────────────────────┐
        │  Supabase Edge Functions │    │  backends/local-api (dev)   │
        │   /sdk/init              │    │  In-memory mirror, no FCM   │
        │   /sdk/register-device   │    │  ───────────────────────    │
        │   /sdk/heartbeat         │    │  Used by local apkzio-    │
        │   /sdk/event             │    │  admin when VITE_APKZIO_  │
        │   /push/track            │    │  API_URL is set.            │
        │   /push/send             │    └─────────────────────────────┘
        │   /apps/stats            │
        └─────────────┬────────────┘
                      │  SECURITY DEFINER RPCs
                      ▼
              ┌──────────────────────────────────┐
              │  Supabase Postgres               │
              │  ───────────────                 │
              │  app_owners        (RLS)         │
              │  android_apps      (RLS)         │
              │  app_devices       (partitioned) │
              │  app_subscribers   (RLS)         │
              │  app_heartbeats    (RANGE / mo)  │
              │  app_analytics_events (partit.)  │
              │  app_push_notifications (queue)  │
              │  app_message_delivery (RANGE)    │
              │  app_counter_shards (64 shards)  │
              │  api_keys (sha256 hashed)        │
              └──────────────┬───────────────────┘
                             │  FOR UPDATE SKIP LOCKED
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
  ┌──────────────────────┐         ┌────────────────────────┐
  │ firebase-service     │  FCM    │ pg_cron jobs           │
  │ Node worker pool     │────►────│  refresh mv_app_live   │
  │  • claim 1 campaign  │         │  aggregate_app_counters│
  │  • page subscribers  │         │  reap_rate_limit       │
  │  • multicast 500 ea. │         │  roll_partitions       │
  │  • LRU per-tenant    │         │  compute_daily_stats   │
  │    Messaging cache   │         │  sweep_dormant_devices │
  │  • record results in │         └────────────────────────┘
  │    bulk via RPC      │
  └──────────┬───────────┘
             │  push_record_delivery_batch(jsonb)
             ▼
        FCM tokens stay in DB; only redacted previews leave it.
```

The Android SDK only ever talks to the Edge functions. The dispatcher is
back-of-house: it never accepts inbound HTTP from third parties — only a
`/healthz` for orchestration.

## What scales when

The platform has three very different traffic shapes. They each load a
different layer.

| Pattern | Driver | Where the load lands | Scaling lever |
| --- | --- | --- | --- |
| **Heartbeats** | Foregrounded SDK pings every ~45s | Edge fn → Postgres write-mostly. `sdk_record_heartbeat` only updates `last_seen_at` if it has drifted ≥ 25s, so the index churn is bounded. | Add Supabase compute (CPU + connections); BRIN indexes keep storage cheap. |
| **Analytics events** | Apps emit batches of up to 100 events | Edge fn → partitioned `app_analytics_events`. Append-only; partitions roll monthly. | More partitions per month if needed; archive older months out of OLTP. |
| **Pushes** | Server-to-server `/push/send`, then the dispatcher fans out | Dispatcher pods + FCM. Each pod pulls one campaign at a time and sends 500-token batches with bounded concurrency. | Scale Cloud Run pods horizontally; each pod claims a different row thanks to `SKIP LOCKED`. |
| **Signup / onboarding** | Once per app | Edge fn touching `app_owners` + `android_apps` | Negligible — capacity-planned at zero. |
| **Dashboard reads** | Owners viewing analytics | `apps-stats` edge fn → daily rollups + `mv_app_live_users` materialized view | The materialized view refreshes on a 1-minute cron, so dashboard pages cost a single index seek even at scale. |

The split is deliberate: the path that runs millions of times per minute
(heartbeats) is bounded write-only Postgres work; the path that runs once per
campaign (a push send) gets a long-lived worker because it needs warm FCM
connections, retry budgets in seconds, and per-tenant credentials.

## Security model

ApkZio layers four kinds of credential, each with a narrow blast radius:

| Credential | Holder | Scope | Storage |
| --- | --- | --- | --- |
| `pk_…` **app key** | Android SDK (compiled into APK) | Identifies which app a request belongs to. Rate-limited per-key + per-IP. *Public by design* — like a Sentry DSN. | Plaintext column on `android_apps`. |
| `sk_live_…` **service key** | Customer's backend | Authorizes `/push/send` and other server-to-server endpoints. | Only `sha256(key)` is stored; the prefix is recoverable for display. |
| **Supabase JWT** | Dashboard users | Validates the signed-in `app_owners.owner_id`. Every dashboard-bound endpoint relies on this for tenant isolation via RLS. | Supabase Auth managed; never written by app code. |
| **FCM credentials** | Per-app `android_apps.fcm_credentials` (optional) or shared `DEFAULT_FCM_CREDENTIALS` env on the dispatcher | Signs FCM messages. Customers can BYO Firebase project for analytics & quota. | Encrypted at rest in Supabase; never returned via the API. |

Layered defenses, in addition:

- **RLS on every tenant table.** `current_owner_id()` is a `STABLE
  SECURITY DEFINER` function joining through `app_owners.auth_user_id`.
  No code path that runs under an end-user JWT can read another tenant's
  rows, regardless of bug.
- **Token redaction.** Raw `fcm_token` lives only on `app_subscribers`
  with a generated `token_hash` BTREE index. Owners see redacted previews
  through `v_subscriber_status`.
- **Rate limits at four tiers.** `(app_key, IP)` on `/sdk/init`, per-device
  on heartbeats and events, per-API-key on `/push/send`, per-device on
  `/push/track`. Buckets are reaped by `pc_reap_ratelimit` every 15
  minutes.
- **Cross-app linking is prevented.** `install_hash =
  sha256(app_key‖android_id)`, so the same physical device in two
  different apps appears as two unrelated subscribers.

## Failure modes & recovery

| Failure | Effect | Recovery |
| --- | --- | --- |
| Dispatcher pod crashes mid-campaign | Row is left in `dispatching`; lock is released by Postgres; another pod picks it up via `SKIP LOCKED`. | Automatic. Idempotent thanks to dedup on `(notification_id, device_id)`. |
| FCM credentials revoked | Dispatcher logs `messaging/mismatched-credential`; tokens are flagged `status=6 (token_invalid)` so the SDK re-registers on next heartbeat. | Rotate credentials in `android_apps.fcm_credentials`; the LRU cache evicts the stale Messaging instance after 6h or 200 entries. |
| Heartbeat write storm | BRIN indexes keep storage flat; `last_seen_at` updates are coalesced (skip if Δ < 25s). | Burst-safe up to ~15k req/s per Supabase project — see `backends/README.md` performance table. |
| Partition rollover failed | New month starts with no partition; inserts error. | `pc_roll_partitions` retries on the next 03:00 UTC daily; manual rerun via `select roll_partitions_forward();`. |
| Cron job stops | Materialized views go stale, daily stats stop. | `select * from cron.job_run_details order by start_time desc;` and rerun manually. |

## Where to read next

- `backends/README.md` — schema rationale and per-table indexing strategy.
- `backends/api.md` — exhaustive endpoint reference.
- `backends/operations.md` — runbook for incidents and maintenance.
- `backends/deployment.md` — production rollout, secret wiring, smoke tests.
