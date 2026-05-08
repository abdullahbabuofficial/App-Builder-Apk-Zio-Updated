# WordPress plugin ↔ ApkZio local API

Versioned endpoints live under `/api/wp/v1/`. They are **not** admin routes: do not send `x-apkzio-admin-key`. Authenticate each site with its own **site token** returned once from `register`.

## Register site

`POST /api/wp/v1/register`

```json
{
  "plugin_id": "<uuid from GET /api/wp-plugins>",
  "site_url": "https://example.com",
  "wp_version": "6.5",
  "plugin_version": "1.0.0"
}
```

Response:

```json
{
  "ok": true,
  "site": { "id": "...", "plugin_id": "...", "site_url": "...", ... },
  "site_token": "wpt_<secret>"
}
```

Store `site_token` in WordPress (e.g. `update_option`) immediately; it cannot be retrieved again from the API.

## Telemetry (heartbeat)

`POST /api/wp/v1/telemetry`

Headers (one of):

- `Authorization: Bearer <site_token>`
- `X-Apkzio-Site-Token: <site_token>`

Body:

```json
{
  "site_id": "<uuid from register response>",
  "pageviews_delta": 120,
  "uniques_delta": 45,
  "subscribers_total": 890,
  "wp_version": "6.5",
  "plugin_version": "1.0.1"
}
```

- `pageviews_delta` / `uniques_delta`: counts since the **last successful** telemetry call (reduces payload size).
- `subscribers_total`: absolute web-push subscriber count the plugin tracks.

Rate limit: **120 requests per minute per `site_id`** (HTTP 429 when exceeded).

## Local seed tokens

Seeded demo installs accept `wpt_local_<site_id>` where `<site_id>` is the UUID shown in the admin **Connected sites** table. Use only for local smoke tests; production sites must use tokens from `register`.

## Admin read APIs

`GET /api/wp-plugins?range=rt|d|w|m` — catalog + rollups.

`GET /api/wp-plugins/:pluginId?range=...` — detail + merged series.

`GET /api/wp-plugins/:pluginId/sites?q=&limit=&offset=&include_series=1` — paginated installs.

## WordPress plugin ZIP (admin)

`GET /api/wp-plugins/:pluginId/distribution.zip` — streams a ZIP containing the **ApkZio Telemetry** plugin folder. The archive includes `apkzio-embedded-config.php` with `APKZIO_EMBEDDED_PLUGIN_ID` set to that catalog row’s UUID so WordPress can pre-fill the Plugin ID field.

Use the ApkZio admin **Plugins** list or product detail page **Download WP plugin** action (same URL, with admin auth headers as other dashboard APIs).

When `ENFORCE_ADMIN_AUTH=1`, these routes require `x-apkzio-admin-key` or a privileged Bearer user (same as other `/api/*` dashboard routes).
