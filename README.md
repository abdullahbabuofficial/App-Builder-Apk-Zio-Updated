# PushCare

PushCare is an open-core platform for **app installation tracking, real-time
analytics, and push notification delivery** — the responsibilities of OneSignal,
Firebase Analytics, and Appsflyer collapsed into a single self-hostable stack.
It is built on Supabase (Postgres + Edge Functions) for ingestion, a Node
worker for FCM dispatch, and a React admin console.

## Workspaces

| Path | What it is |
| --- | --- |
| `supabase/` | Postgres schema (6 timestamped migrations) + 11 Edge Functions + `config.toml` for the Supabase CLI |
| `backends/firebase-service/` | FCM dispatcher — claims queued campaigns and sends batches via `firebase-admin` |
| `backends/apk-builder/` | Queue worker that produces signed APKs from the `apk_builds` table (currently simulated; clear seam for real Gradle) |
| `backends/local-api/` | In-memory dev REST API. Boots in <1s, mirrors the SDK and dashboard surface for offline UI work |
| `pushcare-admin/` | Admin + customer console — React + Vite. Public landing/pricing/signup, onboarding wizard, account/billing/team, plus the original control plane |
| `pushcare-subscriber-portal/` | End-user preferences mini-app — opens via signed JWT link from the Android SDK, lets a user pause / opt out / delete their subscription |

## Quick start (local)

```bash
git clone <repo-url> pushcare && cd pushcare

# 1. Boot the dev REST API on http://localhost:8787
cd backends/local-api && npm install && npm run dev &

# 2. Boot the admin console on http://localhost:5173
cd ../../pushcare-admin && npm install && npm run dev
```

Sign in with any email/password (the dev API stubs auth), copy an `app_key`
from the Apps page, and follow `backends/WORKFLOW.md` for the curl recipes.

## Architecture

```
                              ┌──────────────────────────┐
   Android SDK                │  /sdk/init               │
   ──────────────────────────►│  /sdk/register-device    │   Supabase Edge
                              │  /sdk/heartbeat          │   Functions
                              │  /sdk/event              │   (Deno runtime)
                              │  /push/track             │
                              └─────────────┬────────────┘
                                            │ SECURITY DEFINER RPCs
                                            ▼
                                ┌────────────────────┐
                                │ Supabase Postgres  │   partitioned hot
   Dashboard / S2S              │   + RLS + pg_cron  │   tables, sharded
   ─────────────────────►       └─────────┬──────────┘   counters
                                          │
                            FOR UPDATE    │
                            SKIP LOCKED   ▼
                              ┌──────────────────────┐         ┌─────────────┐
                              │  firebase-service    │  FCM    │ Firebase    │
                              │  Node worker, retries│────────►│ Cloud       │
                              │  per-tenant LRU      │ batches │ Messaging   │
                              │  cache of Messaging  │         └─────▲───────┘
                              └──────────┬───────────┘               │ tokens
                                         │ push_record_delivery_batch│
                                         └───────────────────────────┘

   ┌────────────────────────────┐                ┌─────────────────────────────┐
   │ pushcare-admin (React/Vite)│  HTTPS+JWT     │  backends/local-api (dev)   │
   │  control plane / analytics │ ──── or ────►  │  in-memory mirror, no FCM   │
   │  + signup / onboarding     │                │                             │
   │  + account / billing / team│                │                             │
   └────────────────────────────┘                └─────────────────────────────┘

   ┌────────────────────────────┐                ┌─────────────────────────────┐
   │ pushcare-subscriber-portal │  signed JWT    │  apk-builder (queue worker) │
   │  end-user opt-out / pause  │  link from SDK │  produces signed APKs       │
   └────────────────────────────┘                └─────────────────────────────┘
```

## Deeper docs

- [`backends/README.md`](backends/README.md) — schema rationale, performance targets, security model
- [`backends/api.md`](backends/api.md) — full HTTP contract for SDK + server-to-server endpoints
- [`backends/deployment.md`](backends/deployment.md) — production rollout (Supabase + Cloud Run)
- [`backends/operations.md`](backends/operations.md) — runbook (incidents, partitions, FCM key rotation)
- [`backends/WORKFLOW.md`](backends/WORKFLOW.md) — local demo path, end-to-end production rollout
- [`docs/architecture.md`](docs/architecture.md) — single-file high-level architecture overview

## Deployment helpers

| Script | Purpose |
| --- | --- |
| `deploy-supabase.sh` | One-shot: link → migrate → deploy edge fns → register cron jobs |
| `deploy-dispatcher.sh` | Build + push Docker image + `gcloud run deploy` for the FCM worker |
| `deploy-pushcare-server.sh` | Bare-metal recipe: systemd service + Apache vhosts for the local API and admin console |

## Tests / CI

Each workspace ships its own `npm test` (vitest). GitHub Actions
(`.github/workflows/ci.yml`) builds and tests every workspace on push and PR,
plus a sanity check on the SQL migration headers.

## License

Internal. See repo owner.
