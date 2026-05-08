# Edge Function secrets (reference)

No real secrets belong in git. Use Supabase **Edge Function secrets** (Dashboard or CLI). Copy naming from [`supabase/functions/.env.example`](../supabase/functions/.env.example) for local mental model only.

## Automatically injected

Supabase provides **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** to Edge Functions — do not commit values.

## `team-invite`

| Variable | Required when | Purpose |
|----------|----------------|---------|
| `INVITE_EMAIL_MODE` | Optional | `stub` (default) vs `resend`. |
| `INVITE_APP_BASE_URL` | Recommended | Dashboard origin for join links (no trailing slash). |
| `RESEND_API_KEY` | `resend` mode | Resend API key. |
| `INVITE_EMAIL_FROM` | `resend` mode | Sender address. |
| `INVITE_EMAIL_SUBJECT` | Optional | Override subject line. |

See header comments in [`supabase/functions/team-invite/index.ts`](../supabase/functions/team-invite/index.ts).

## `webhook-deliver`

| Variable | Required when | Purpose |
|----------|----------------|---------|
| `WEBHOOK_SIGNING_SECRET` | Optional fallback | HMAC key when endpoint row has no `signing_secret`. |

See [`supabase/functions/webhook-deliver/index.ts`](../supabase/functions/webhook-deliver/index.ts).

## SDK routes (`sdk-init`, etc.)

No extra Edge secrets beyond Supabase defaults for typical installs — auth is `X-PC-App-Key` / body UUIDs per handlers.
