# ApkZio end-to-end workflow

This document ties together **subscriber acquisition**, **messaging**, and **operations** so you can grow from local demos to production (Supabase + FCM worker).

> **Note:** `backends/mnt/` is **stale reference material** only (old stub paths). For production, use the root `supabase/functions/` tree and `_shared` there — do not treat `mnt/` as the source of truth.

## 0. Stay aligned with your Supabase database (recommended)

Use **one** `SUPABASE_PROJECT_REF` everywhere:

1. Put secrets in `backends/.env`, `backends/firebase-service/.env`, `apkzio-admin/.env.local`, `apkzio-pub/.env.local` (see each `.env.example`).
2. Print matching variable patterns: `make supabase-env-hints SUPABASE_PROJECT_REF=<ref>` from the repo root.
3. Cursor MCP: replace `YOUR_PROJECT_REF` in `.cursor/mcp.json` (see `.cursor/README.md`) and complete the Supabase auth prompt.

The **dispatcher** (`firebase-service`) must use a **direct** Postgres `DATABASE_URL` to that project; **local-api** stays in-memory unless you add a Postgres backend separately.

## 1. Local demo (fastest path)

```text
Android/SDK          Dashboard (React)
    │                       │
    ▼                       ▼
backends/local-api ◄────────┘   GET/POST /api/*
```

1. Start API: `cd backends/local-api && npm install && npm run dev` → `http://localhost:8787`
2. Copy `.env.example` → `.env` in `apkzio-admin`, set `VITE_APKZIO_API_URL=http://localhost:8787`
3. Start UI: `cd apkzio-admin && npm run dev`
4. Sign in with demo auth (any email/password).
5. Open **Apps** → copy an app’s `app_key` (`pk_…`).
6. Simulate installs:

```bash
curl -s -X POST http://localhost:8787/sdk/init \
  -H "Content-Type: application/json" \
  -H "X-PC-App-Key: YOUR_PK_HERE" \
  -d "{\"android_id\":\"device-demo-1\",\"fcm_token\":\"fake-token-123\",\"country_code\":\"US\",\"model\":\"Pixel\"}"
```

7. Refresh **Devices / Subscribers** — counts reflect store updates.
8. Create a campaign from **Campaigns → New** or enqueue via server key:

```bash
curl -s -X POST http://localhost:8787/push/send \
  -H "Authorization: Bearer sk_live_demo_apkzio_local" \
  -H "Content-Type: application/json" \
  -d "{\"app_id\":\"YOUR_APP_UUID\",\"title\":\"Hi\",\"body\":\"From curl\",\"target\":{\"type\":\"all\"}}"
```

The local API is **in-memory** (restart clears data). It **does not** call Firebase; sends are simulated with realistic recipient counts.

## 2. Staged production architecture

Aligned with `backends/README.md` and `backends/api.md`:

| Stage | Role |
|-------|------|
| **Supabase Postgres** | Source of truth: apps, devices, subscribers, campaigns queue, deliveries (SQL in `001_*.sql` … `005_*.sql`). |
| **Edge Functions** | SDK ingress (`/sdk/*`), enqueue `/push/send`, `/push/track`, dashboard aggregates `/apps/stats`. Deno examples live under `backends/mnt/user-data/outputs/apkzio-backend/supabase/functions/` — deploy needs `_shared/utils.ts` on Supabase. |
| **firebase-service** | Node worker: `FOR UPDATE SKIP LOCKED` queue drain → FCM `sendEachForMulticast` → `push_record_delivery_batch`. |

Recommended rollout:

1. Apply migrations (`supabase db push` or your Postgres runner).
2. Deploy Edge Functions + configure secrets (`SUPABASE_URL`, service role, Firebase placeholders).
3. Run **`backends/firebase-service`** with `DATABASE_URL` and `DEFAULT_FCM_CREDENTIALS` (or per-app credentials in DB).
4. Point **`apkzio-admin`** at Supabase-authenticated APIs or your BFF that proxies JWT + REST.

## 3. Frontend integration toggle

| `VITE_APKZIO_API_URL` | Behaviour |
|-------------------------|-----------|
| *(unset)* | Built-in mock datasets (`mock-data.ts`). Good for UI-only work. |
| `http://localhost:8787` | Live reads/writes against **local-api** (same-origin CORS enabled). |

## 4. What we completed in-repo

- **`backends/local-api`**: REST surface for the dashboard + subset of SDK/server routes for integration testing.
- **`apkzio-admin`**: `ApkzioProvider` + `useApkzio()` wire lists, campaigns, keys, builds, devices, subscribers, and analytics to that API when configured.
- **`backends/firebase-service`**: Dispatcher sources consolidated under `firebase-service/` (see folder README in parent `README.md`).

Next steps for full production: finish Edge `_shared` utilities in Supabase repo layout, wire admin auth to Supabase JWT, and replace local-api reads with `/apps/stats` + RLS-backed queries.
