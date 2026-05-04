# PushCare API Reference

Base URL (Edge Functions):

```
https://<project-ref>.functions.supabase.co
```

All requests are JSON. All responses include `ok: boolean`. On error, responses also carry `error: { code, message }`.

---

## Authentication tiers

| Tier | Used by | Header | Notes |
|---|---|---|---|
| **App key** (`pk_<48hex>`) | Android SDK | `X-PC-App-Key: pk_...` | Public, embedded in APK. Identifies the app, not the user. Counter-protected by per-app + per-IP rate limits. |
| **Service key** (`sk_live_...` / `sk_test_...`) | Your dashboard / backend | `Authorization: Bearer sk_...` | Secret. Stored hashed in `api_keys`. Scoped (`push:send`, `analytics:read`, …) and rate-limited per-key. |
| **Supabase JWT** | Logged-in dashboard user | `Authorization: Bearer <jwt>` + `apikey: <anon>` | RLS narrows results to the calling owner. |

> **Never** ship a service key in an APK. The Android SDK only knows the app key.

---

## SDK endpoints (called by the Android SDK)

### `POST /sdk/init`

Called once per cold start, and the first time an install ever talks to PushCare. Idempotent on `(app_key, android_id)`.

Headers:

```
X-PC-App-Key: pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Request:

```json
{
  "android_id": "9774d56d682e549c",
  "fcm_token": "fcm-registration-token...",
  "app_version": "2.4.1",
  "os_version": "14",
  "device_model": "Pixel 8",
  "manufacturer": "Google",
  "language": "en",
  "timezone": "Asia/Dhaka",
  "country_code": "BD"
}
```

Response `200`:

```json
{
  "ok": true,
  "device_id": "0b6f5b30-3d1c-4a3b-9b70-7e2e5b2e4c3d",
  "app_id":    "8a7e1b22-2c14-4a3a-83b0-4f0c5b2b0e10",
  "subscriber_id": "c4fe2a98-7c1d-4f63-9a2c-1c8e6c7c0f02",
  "is_new_install": true,
  "heartbeat_interval_sec": 45
}
```

Errors: `400 invalid_request`, `401 invalid_app_key`, `403 app_suspended`, `429 rate_limited`.

Rate limit: **30 req / min** per `(app_key, ip)`.

---

### `POST /sdk/register-device`

Used **only** for FCM token rotation after the initial install. Cheap path that updates `app_subscribers` without touching the install counters.

Request:

```json
{
  "device_id": "0b6f5b30-3d1c-4a3b-9b70-7e2e5b2e4c3d",
  "app_key":   "pk_xxxx...",
  "fcm_token": "new-fcm-token..."
}
```

Response `200`:

```json
{ "ok": true, "subscriber_id": "c4fe2a98-..." }
```

Rate limit: **10 req / min** per device.

---

### `POST /sdk/heartbeat`

The hottest endpoint. Called every 30–60 s while the app is foregrounded. Designed to be cheap (one INSERT into a partition + a conditional UPDATE).

Request:

```json
{
  "device_id":    "0b6f5b30-...",
  "app_id":       "8a7e1b22-...",
  "session_id":   "f1e8c7b6-a5d4-43c2-b1a0-9876543210fe",
  "country_code": "BD",
  "app_version":  "2.4.1"
}
```

Response `200`:

```json
{ "ok": true }
```

Rate limit: **4 req / min** per device. Excess heartbeats are silently dropped — never returned as `4xx` to the SDK.

---

### `POST /sdk/event`

Single event or a batch of up to **100** events.

Request (single):

```json
{
  "device_id": "0b6f5b30-...",
  "app_id":    "8a7e1b22-...",
  "event_name": "purchase_completed",
  "event_params": { "sku": "pro_monthly", "price_usd": 9.99 },
  "session_id": "f1e8c7b6-...",
  "country_code": "BD",
  "app_version": "2.4.1"
}
```

Request (batch):

```json
{
  "device_id": "0b6f5b30-...",
  "app_id":    "8a7e1b22-...",
  "events": [
    { "event_name": "screen_view", "event_params": { "screen": "home" } },
    { "event_name": "button_click", "event_params": { "id": "buy_now" } }
  ]
}
```

Response `200`:

```json
{ "ok": true, "accepted": 2, "rejected": 0 }
```

Constraints:

- `event_name`: 1–64 chars, `[A-Za-z0-9_]`
- `event_params`: ≤ 4096 bytes JSON, ≤ 64 keys

Rate limit: **600 events / min** per device.

---

### `POST /push/track`

Engagement callbacks fired by the SDK when a notification is delivered, opened, or clicked.

Request:

```json
{
  "notification_id": "9c0bdefe-...",
  "device_id":       "0b6f5b30-...",
  "event":           "opened"
}
```

`event` ∈ `{"delivered", "opened", "clicked"}`. Each transition is recorded once per `(notification_id, device_id)`.

Rate limit: **60 req / min** per device.

---

## Server-to-server endpoints

### `POST /push/send`

Enqueue a campaign. Returns immediately with `202 Accepted`; the dispatcher worker picks it up and fans out to FCM.

Headers:

```
Authorization: Bearer sk_live_<YOUR-SERVICE-KEY>
Content-Type: application/json
```

Request:

```json
{
  "app_id":   "8a7e1b22-...",
  "title":    "Flash sale ends in 2h",
  "body":     "Tap to grab 30% off the Pro plan",
  "image_url": "https://cdn.example.com/promo.jpg",
  "click_url": "myapp://promo/flash",
  "data": { "campaign": "flash_sale_2026_05" },
  "target": {
    "type": "active",
    "active_within_minutes": 1440,
    "country_codes": ["BD", "IN", "PK"]
  },
  "scheduled_at": null
}
```

`target.type` ∈:

| value | semantics |
|---|---|
| `all` | every valid subscriber for the app |
| `active` | devices with a heartbeat inside `active_within_minutes` |
| `country` | devices with `country_code IN (...)` |
| `device_list` | explicit `device_ids: uuid[]` (max 100k) |
| `segment` | named segment from `app_segments` (reserved) |

Response `202`:

```json
{
  "ok": true,
  "notification_id": "9c0bdefe-7c1d-4a3b-9b70-...",
  "status": "queued"
}
```

Errors: `400 invalid_target`, `401 invalid_api_key`, `403 scope_missing`, `404 app_not_found`, `429 rate_limited`.

Per-key rate limit: configured via `api_keys.rate_limit_rpm` (default `600`).

---

### `GET /apps/stats`

Dashboard query. Auth: Supabase JWT (the Authorization header is forwarded so RLS scopes results to the owner).

Query:

```
GET /apps/stats?app_id=<uuid>&range=24h|7d|30d|90d
```

Response `200` (cached 30s, `cache-control: private`):

```json
{
  "ok": true,
  "app": {
    "id":   "8a7e1b22-...",
    "name": "Acme",
    "package_name": "com.acme.app"
  },
  "now": {
    "live_users": 18421,
    "active_1h":  74220,
    "active_24h": 612083
  },
  "window": {
    "range": "7d",
    "totals": {
      "new_installs":     412318,
      "active_devices":   1842099,
      "events":           48210911,
      "sessions":         9120712,
      "push_sent":        1840000,
      "push_delivered":   1521004,
      "push_opened":      221900,
      "push_clicked":      94312
    }
  },
  "daily": [
    {
      "stat_date": "2026-04-28",
      "new_installs": 58210,
      "active_devices": 263201,
      "events": 6920310,
      "sessions": 1304211,
      "push_sent": 240000,
      "push_delivered": 198100,
      "push_opened": 28110,
      "push_clicked": 11200
    }
  ]
}
```

---

## Error envelope

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Try again in 60s."
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_request` | 400 | Body failed validation |
| `invalid_app_key` | 401 | App key not found / not `pk_…` format |
| `invalid_api_key` | 401 | Service key not found / disabled |
| `app_suspended` | 403 | App is disabled |
| `scope_missing` | 403 | Service key lacks required scope |
| `not_found` | 404 | Referenced resource does not exist |
| `rate_limited` | 429 | Bucket exhausted |
| `internal` | 500 | Unhandled — investigate logs by `request_id` |

Every response carries `x-request-id` — pass it back to support to find the call in `pg_stat_statements` / Supabase logs.
