# Production readiness tracker

Checklist for rolling ApkZio to production. Update checkboxes as work completes.

## P0 — Docs & hygiene

- [x] `backends/deployment.md` matches repo (migrations list, edge deploy commands vs `config.toml`)
- [x] `backends/local-api/.builds/` ignored in root `.gitignore`
- [x] Warning: `backends/mnt/` is reference-only (see `backends/README.md`, `WORKFLOW.md`)

## P1 — Env, secrets, CI (manual / ongoing)

- Add production env templates for `apkzio-admin` (`VITE_*`) and document required Supabase vs REST vs mock behavior.
- Store secrets in the host (Vercel/Cloudflare/etc.) or secret manager; avoid committing `.env.production`.
- Confirm GitHub Actions secrets if any admin deploy job is added later.
- **Operator checklist:** [`docs/OPERATOR_RUNBOOK_P1_P2.md`](OPERATOR_RUNBOOK_P1_P2.md) (Supabase link, `db push`, cron SQL, Edge deploy + JWT flags, Edge secrets, dispatcher, smoke curls).
- **CI:** `.github/workflows/admin-ci.yml` runs lint + build for `apkzio-admin` on admin and workflow path changes (uses `npm ci` with `package-lock.json`, or `pnpm` when `pnpm-lock.yaml` exists).
- **Automation scripts (do not yet imply execution — operator credentials still required):**
  - [`scripts/deploy-supabase.sh`](../scripts/deploy-supabase.sh) — `supabase link` + `db push` + dynamic Edge Function deploy with JWT flags parsed from [`supabase/config.toml`](../supabase/config.toml), plus `supabase secrets set` for any non-empty `INVITE_APP_BASE_URL`, `INVITE_EMAIL_MODE`, `RESEND_API_KEY`, `INVITE_EMAIL_FROM`, `WEBHOOK_SIGNING_SECRET`. Run via `make deploy-supabase`.
  - [`scripts/setup-cron.sql`](../scripts/setup-cron.sql) — idempotent (`cron.job` guarded) `DO` block scheduling the six jobs from [`backends/deployment.md`](../backends/deployment.md) §2. Run via `make setup-cron` (needs `DATABASE_URL`).
  - [`Makefile`](../Makefile) — operator entry points: `deploy-supabase`, `setup-cron`, `deploy-dispatcher`, `healthcheck`, `verify-dispatcher`.
  - **Status:** Scripts are linted and offline-verified; **not** executed against staging — that step requires Supabase CLI auth (`SUPABASE_ACCESS_TOKEN` or interactive `supabase login`) which is not stored in the repo.

## P2 — Observability & ops (manual / ongoing)

- Add client-side error reporting (e.g. Sentry) and/or server log drains for API and Supabase edge functions.
- Define health checks and on-call runbooks for API + database.
- Review RLS policies and Supabase advisors after schema changes.
- **Operator hygiene:** same runbook as P1 — [`docs/OPERATOR_RUNBOOK_P1_P2.md`](OPERATOR_RUNBOOK_P1_P2.md).
- **Automation scripts (operator credentials still required to execute):**
  - [`scripts/deploy-dispatcher.sh`](../scripts/deploy-dispatcher.sh) — `docker build` for [`backends/firebase-service`](../backends/firebase-service), optional `docker push` (gated on `PUSH=true`), and `gcloud run deploy apkzio-dispatcher` with the exact knobs from [`backends/deployment.md`](../backends/deployment.md) §5 (concurrency=1, cpu=2, mem=1Gi, min=2, max=20, env `WORKER_CONCURRENCY` / `POLL_INTERVAL_MS` / `LOG_LEVEL`). Run via `make deploy-dispatcher`.
  - [`scripts/healthcheck.sh`](../scripts/healthcheck.sh) — `curl ${DISPATCHER_URL}/healthz`, exits non-zero unless JSON `ok:true`. Run via `make healthcheck`.
  - **Offline verification gate:** `make verify-dispatcher` runs `npm ci && lint && build && test` inside [`backends/firebase-service`](../backends/firebase-service) — currently green (1 test passing, 0 lint warnings, clean build).
  - **Status:** Cloud Run rollout itself **requires operator credentials** (`gcloud auth login` / Workload Identity, plus Secret Manager entries `${DATABASE_URL_SECRET}` and `${FCM_SECRET}`); the script never invents an auth flow.

## P3 — Critical product fixes

- [x] **Operator CRM (local-api + admin):** client directory/detail, `last_seen_at`, admin filters, CSV export, skeleton + sticky column — see [`docs/ENTERPRISE_CLIENTS_MODULE.md`](ENTERPRISE_CLIENTS_MODULE.md) Phase A.
- [x] Dashboard analytics when `dataSource === "supabase"`: `apps-stats` + JWT, mapped to `AnalyticsOverview`
- [x] **Follow-up:** Production + Supabase: purge `localStorage` demo session key on load; stricter demo sign-in error copy in prod; Sign-in copy clarifies no demo in prod.
- [x] **Follow-up:** High-traffic pages (`Dashboard`, `Analytics`, `Apps`): per-app / per-event install sparklines and Analytics demo KPI deltas use mock seeds only when `dataSource === "mock"` (via `!useLiveApi`); live paths use empty sparklines or placeholders where APIs are not wired.
- [x] **Follow-up:** GitHub Actions `admin-ci.yml` for admin app lint + build.

## P4 — Edge / product gaps (function hardening)

- [x] `team-invite`: `INVITE_EMAIL_MODE=stub|resend`; stub exposes `invite_url` only (no bare token field); resend uses `RESEND_API_KEY` + `INVITE_EMAIL_FROM` (see handler header comment).
- [x] `webhook-deliver`: HMAC signing uses DB `signing_secret` when set, else `WEBHOOK_SIGNING_SECRET` (documented at top of function).
- [x] APK builder: `ApkBuilder` payload aligned with `api.CreateBuildInput` (matches `POST /api/builds` + `store.createBuild` WebView fields).

## P5 — Android SDK (manual / ongoing)

- [ ] GA SDK packaging (Maven Central), store listing, and client integration hardening.
- [x] Maven publish guidance + WorkManager heartbeat sample documented.
- [x] Shippable library module: [`sdk/android/apkzio-sdk/`](../sdk/android/apkzio-sdk/) — see [`docs/ANDROID_SDK.md`](ANDROID_SDK.md).
- [x] CI (optional path filter): `.github/workflows/android-sdk-ci.yml`.

## P6 — Public site / marketing repo CI

- [x] `.github/workflows/pub-ci.yml`: `npm ci` + `npm run build` for `apkzio-pub/**` on Node 20.
- [x] **Marketing-content cleanup:** purged fabricated stats, fake testimonials, fake team
  members, demo billing/invoice/session rows and placeholder personal data from
  `apkzio-pub` (home sections, `about`, `blog`, `blog-detail`, `contact`, `privacy`,
  `terms`, auth `register` sidepanel, dashboard `overview`/`my-apps`/`cart`/`checkout`/
  `invoices`/`payments`/`plans`/`profile`/`settings`/`subscriptions`/`support`, and
  `footer`). Dashboard pages now read from `lib/api` (`getMyApps` / `getMyBuilds`) and
  `auth-context` with polished empty states; pricing in `dashboard/plans.tsx` is aligned
  with `pages/pricing.tsx` as the source of truth. `npm run build` is green and
  ReadLints reports no errors on touched files. `create-app.tsx` and `apkzio-admin/**`
  intentionally untouched.
