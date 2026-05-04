# Local API — full PushCare workflow (dev)

In-memory HTTP server used by **pushcare-admin** when `VITE_PUSHCARE_API_URL` points here.

## Run

```bash
cd backends/local-api
npm install
npm run dev
```

Default: `http://localhost:8787`

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | Listen port |
| `PUSHCARE_SERVICE_KEY` | `sk_live_demo_pushcare_local` | Bearer token for `POST /push/send` |

## Endpoints

- **Dashboard:** `GET /api/apps`, `GET /api/apps/:id/devices`, `GET /api/apps/:id/subscribers`, `GET /api/campaigns`, `POST /api/campaigns`, `GET /api/api-keys`, `GET /api/builds`, `GET /api/analytics/overview`
- **SDK:** `POST /sdk/init`, `POST /sdk/register-device`, `POST /sdk/heartbeat`, `POST /sdk/event`
- **Server:** `POST /push/send` (Bearer service key), `POST /push/track`

Use header `X-PC-App-Key: pk_…` on `/sdk/init` (see seeded apps from `GET /api/apps`).
