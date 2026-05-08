# Operator runbook — P1 & P2 (manual)

Ordered checklist for humans bringing Apkzio online or repeating production setup. **Do not treat unchecked items as “done”** — tick locally after verification.

References: [`backends/deployment.md`](../backends/deployment.md), [`EDGE_SECRETS.md`](EDGE_SECRETS.md), [`ANDROID_SDK.md`](ANDROID_SDK.md).

## 1. Supabase link & database

1. [ ] Install Supabase CLI (see deployment prerequisites).
2. [ ] `supabase link --project-ref <your-ref>` from repo root (or linked CI/CD context).
3. [ ] `supabase db push` — confirm all migrations in `supabase/migrations/` apply cleanly.

## 2. Cron SQL (post–first migration)

After first successful `db push`, run the **uncommented** schedule block from [`backends/deployment.md`](../backends/deployment.md) § “Schedule the cron jobs” (same SQL as below for convenience):

```sql
select cron.schedule('pc_refresh_live',       '* * * * *',     $$ refresh materialized view concurrently mv_app_live_users $$);
select cron.schedule('pc_aggregate_counters', '* * * * *',     $$ select aggregate_app_counters() $$);
select cron.schedule('pc_reap_ratelimit',    '*/15 * * * *',   $$ select reap_rate_limit_buckets() $$);
select cron.schedule('pc_roll_partitions',   '0 3 1 * *',      $$ select roll_partitions_forward() $$);
select cron.schedule('pc_daily_stats',       '15 0 * * *',     $$ select compute_daily_stats((current_date - 1)) $$);
select cron.schedule('pc_dormant_devices',   '30 4 * * *',     $$ select sweep_dormant_devices() $$);
```

- [ ] Verify: `select jobname, schedule, active from cron.job where jobname like 'pc_%';`

## 3. Edge secrets (team-invite, webhook-deliver)

- [ ] Set secrets via Dashboard (**Edge Functions → Secrets**) or Supabase CLI — see [`EDGE_SECRETS.md`](EDGE_SECRETS.md) and [`supabase/functions/.env.example`](../supabase/functions/.env.example).

Minimum awareness:

| Area | Examples |
|------|-----------|
| Team invites | `INVITE_EMAIL_MODE`, `INVITE_APP_BASE_URL`, optional Resend: `RESEND_API_KEY`, `INVITE_EMAIL_FROM`, `INVITE_EMAIL_SUBJECT` |
| Webhooks | Optional fallback `WEBHOOK_SIGNING_SECRET` |

## 4. Deploy each Edge function with correct JWT flags

JWT behaviour matches [`supabase/config.toml`](../supabase/config.toml) `[functions.*] verify_jwt`.

- [ ] **verify_jwt = false** — deploy with `--no-verify-jwt`:

```bash
supabase functions deploy sdk-init             --no-verify-jwt
supabase functions deploy sdk-register-device   --no-verify-jwt
supabase functions deploy sdk-heartbeat         --no-verify-jwt
supabase functions deploy sdk-event             --no-verify-jwt
supabase functions deploy push-track            --no-verify-jwt
supabase functions deploy push-send             --no-verify-jwt
supabase functions deploy signup-init           --no-verify-jwt
supabase functions deploy webhook-deliver       --no-verify-jwt
```

- [ ] **verify_jwt = true** — deploy **without** `--no-verify-jwt`:

```bash
supabase functions deploy apps-stats
supabase functions deploy apk-build-trigger
supabase functions deploy team-invite
```

## 5. Firebase dispatcher (`firebase-service`)

- [ ] Build image from [`backends/firebase-service`](../backends/firebase-service) using [`backends/firebase-service/.env.example`](../backends/firebase-service/.env.example).
- [ ] Deploy to your host (e.g. Cloud Run — example flags in [`backends/deployment.md`](../backends/deployment.md) § “Cloud Run example”).
- [ ] Health check: `curl https://<dispatcher-host>/healthz`

## 6. Smoke requests

- [ ] Init device — [`backends/deployment.md`](../backends/deployment.md) § “Smoke test end-to-end” (`sdk-init` + optional `push-send`).
- [ ] Confirm dispatcher logs show expected queue behaviour for test pushes.

## P2 — Ongoing (operator hygiene)

- [ ] Client/server error reporting or log drains configured.
- [ ] Health checks and escalation paths documented for API + DB + Edge.
- [ ] After schema changes: Supabase advisors + RLS review.
