# ApkZio Backend

A production-grade backend for app installation tracking, real-time analytics,
and push notification delivery — combining the responsibilities of OneSignal,
Firebase Analytics, and Appsflyer into one platform. Built on Supabase
(Postgres + Edge Functions) and a Firebase Admin dispatcher service.

## Architecture at a glance

```
                ┌──────────────────────────┐
   Android SDK  │  /sdk/init               │
   ───────────► │  /sdk/register-device    │  Supabase Edge Functions
                │  /sdk/heartbeat          │  (Deno runtime)
                │  /sdk/event              │
                │  /push/track             │
                └─────────────┬────────────┘
                              │ SECURITY DEFINER RPCs
                              ▼
                    ┌────────────────────┐
                    │   Supabase Postgres│  (schema + partitioned hot
                    │                    │   tables + RLS)
                    └─────────┬──────────┘
                              │  FOR UPDATE SKIP LOCKED
                              │
   Dashboard /                ▼
   server-to-server     ┌──────────────────────┐         ┌─────────────┐
   ─────────────────►   │ /push/send (queue)   │         │   FCM       │
                        └──────────────────────┘         │   (Firebase)│
                                                         └─────▲───────┘
                              ┌─────────────────────────┐      │
                              │  firebase-service       │──────┘ batches
                              │  (Node worker pool,     │
                              │   pulls campaigns,      │
                              │   sends FCM, records    │
                              │   delivery, retries,    │
                              │   prunes invalid tokens)│
                              └─────────────────────────┘
```

### Why this split?

- **Edge Functions** for SDK traffic. Cold-start in <100ms, run close to
  users, scale to zero when idle. Perfect for short, stateless requests.
- **Postgres functions (RPC)** for write paths. Bundling 4-table upserts
  into one round trip beats orchestrating from Deno every time.
- **Long-lived Node worker** for FCM. The Firebase Admin SDK is heavy,
  needs warm connections, and retries with backoff over many seconds —
  exactly the wrong shape for an Edge Function.

## Folder structure

```
backends/
├── README.md
├── WORKFLOW.md           ← end-to-end plan (local → production)
├── api.md
├── *.sql                 ← Postgres migrations (001 … 005)
├── firebase-service/     ← FCM dispatcher (Node, package.json + src/)
├── local-api/            ← Dev-only in-memory HTTP API
├── mnt/...               ← **Stale reference only** — historical Edge Function stubs; do not edit or deploy from here for production (use `supabase/functions/` in the repo root).
└── utils.ts              ← Deno _shared helper reference (for Edge runtime)
```

## Schema rationale

| Concern                       | Solution                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hot append-only tables blow up indexes | RANGE partitioning by month on `app_heartbeats`, `app_analytics_events`, `app_message_delivery`. Drop old partitions in O(1). |
| Counter row contention        | `app_counter_shards` table — 64 shards per app, fold to canonical counters every minute via `aggregate_app_counters`.            |
| Token storage / privacy       | `token_hash` is a generated SHA-256 column; raw `fcm_token` never appears in indexes. Subscribers indexed by `(app_id, token_hash)`. |
| Avoiding cross-app linking    | `install_hash = sha256(app_key ‖ android_id)` — same physical phone in two apps gets two unrelated hashes.                        |
| Index churn on `last_seen`    | `sdk_record_heartbeat` only updates `last_seen_at` if it has drifted >25s. Burst traffic doesn't thrash the btree.               |
| BRIN vs btree on time columns | BRIN on `first_seen_at` / per-partition heartbeats: massive space savings, range queries are still fast.                          |
| Multi-tenant isolation        | RLS on every tenant table; `current_owner_id()` is a `STABLE SECURITY DEFINER` function joined through `app_owners.auth_user_id`. |
| Long-running token sweeps     | Sharded `app_subscribers` lookups via `push_target_subscribers(... after_sub_id)` — keyset pagination that uses the unique index. |

## API endpoints

| Method | Path                    | Auth                   | Purpose                                              |
| ------ | ----------------------- | ---------------------- | ---------------------------------------------------- |
| POST   | `/sdk/init`             | `X-PC-App-Key: pk_...` | First-call: upsert device, register FCM token, increment installs. |
| POST   | `/sdk/register-device`  | `X-PC-App-Key`         | Re-register after FCM token rotation.                 |
| POST   | `/sdk/heartbeat`        | none (device_id-bound) | Ping every 30–60s while app is foregrounded.          |
| POST   | `/sdk/event`            | none                   | Single event or batch (≤100) of analytics events.     |
| POST   | `/push/track`           | none                   | SDK-side delivered/opened/clicked tracking.           |
| POST   | `/push/send`            | `Authorization: Bearer sk_...` | Queue a push campaign (returns 202).      |
| GET    | `/apps/stats`           | dashboard JWT          | Per-app aggregates over a range.                      |

See [`api.md`](./api.md) for full request/response schemas.

## Quick start

```bash
git clone https://github.com/abdullahbabuofficial/apkzio.git
cd apkzio-backend

# 1. Apply database migrations
supabase link --project-ref <YOUR-REF>
supabase db push

# 2. Deploy edge functions (every function + --no-verify-jwt vs JWT: see deployment.md §3)
supabase functions deploy sdk-init sdk-register-device sdk-heartbeat \
                          sdk-event push-track push-send apps-stats

# 3. Boot the FCM dispatcher
cd firebase-service
cp .env.example .env  # fill in DATABASE_URL and DEFAULT_FCM_CREDENTIALS
npm install && npm run build && npm start

# Local-only: in-memory API + dashboard wiring (see WORKFLOW.md)
cd ../local-api && npm install && npm run dev
```

Production deployment guide: [`deployment.md`](./deployment.md).

## Performance targets

| Endpoint            | p50      | p99       | Throughput per Supabase project |
| ------------------- | -------- | --------- | ------------------------------- |
| `/sdk/heartbeat`    | < 25 ms  | < 100 ms  | ≥ 15 k req/s                    |
| `/sdk/init`         | < 40 ms  | < 150 ms  | ≥ 4 k req/s                     |
| `/sdk/event` (batch)| < 50 ms  | < 200 ms  | ≥ 2 k req/s (× 100 events)      |
| `/push/send`        | < 30 ms  | < 80 ms   | (returns 202; dispatcher does the work) |
| Push throughput     | —        | —         | ≥ 1.5 M deliveries / minute / dispatcher pod |

## Security model

- **SDK calls** authenticate with a public `app_key` (rate-limited). Never
  sensitive — same role as a Sentry DSN or Mixpanel project token.
- **Server-to-server** calls (`/push/send`) require an `sk_live_*` key.
  Hashed in DB (`api_keys.key_hash`); only the prefix is recoverable.
- **Dashboard** uses Supabase Auth JWTs; RLS scopes every read to the
  signed-in `app_owners.owner_id`.
- **FCM tokens** never leave the database. Even owners see only a redacted
  preview through `v_subscriber_status`.
- **Rate limiting** at four tiers: per-(app_key, IP) on init,
  per-device on heartbeat/event, per-API-key on /push/send,
  per-device on /push/track.

## License

Internal — see repo root.
