# Local API — full ApkZio workflow (dev)

In-memory HTTP server used by **apkzio-admin** when `VITE_APKZIO_API_URL` points here.

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
| `APKZIO_SERVICE_KEY` | `sk_live_demo_apkzio_local` | Bearer token for `POST /push/send` |
| `ENFORCE_ADMIN_AUTH` | `0` (dev), `1` (production) | Require admin key or verified business/enterprise user on admin API routes |
| `APKZIO_ADMIN_API_KEY` | same as `APKZIO_SERVICE_KEY` | Admin key accepted by `x-apkzio-admin-key` when admin auth is enforced |
| `APKZIO_ENABLE_APK_BUILD` | *(unset)* = auto | **Auto:** run `gradle assembleDebug` when `java`, `gradle`, and `ANDROID_HOME`/`ANDROID_SDK_ROOT` are usable. **`1`:** explicit. **`0`:** ZIP-only (no APK on server). |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | — | Required on the API host for APK output (along with JDK). **Gradle:** the template ships **`gradlew` + wrapper jar** (Gradle 8.10.x), so an ancient system `gradle` (e.g. Ubuntu 4.x) does **not** block APK builds — only Android SDK + Java are required once the wrapper is present. |
| `APKZIO_GRADLE_TASK` | `assembleDebug` | **Fixed to debug APK** for sideload / internal use only — not for Play Store publishing. |
| `APKZIO_GRADLE_TIMEOUT_MS` | `1200000` (20 min) | Gradle wall-clock limit (clamped 2–120 minutes). |
| `APKZIO_GRADLE_HEAP` | `2g` | Passed as `JAVA_TOOL_OPTIONS` `-Xmx…` for the Gradle child process. |
| `APKZIO_MAX_CONCURRENT_GRADLE` | `1` | Parallel Gradle builds when APK pipeline is on (1–4). |
| `APKZIO_TRUST_PROXY` | *(unset)* | Set `1` when behind nginx/Cloudflare so `req.ip` + rate limits use `X-Forwarded-For`. |
| `APKZIO_BUILDER_RATE_LIMIT_MAX` | `30` | Max `POST /api/builder/builds` per IP per window; `0` disables. |
| `APKZIO_BUILDER_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window length. |
| `LOG_LEVEL` | `info` | Structured log verbosity |

## Docker (URL → APK on a server)

Image `backends/local-api/Dockerfile` bundles **Node 20 + JDK 17 + Gradle 8.10 + Android SDK 34** so APK builds work without hand-installing the toolchain.

```bash
# From repo root
docker compose -f docker-compose.local-api.yml build
docker compose -f docker-compose.local-api.yml up -d
```

Artifacts persist in volumes `apkzio-local-api-builds` and `apkzio-gradle-user-home` (dependency cache).

## Bare-metal toolchain (Debian/Ubuntu)

```bash
sudo bash scripts/install-android-builder-host.sh
```

Then set `ANDROID_HOME` / `ANDROID_SDK_ROOT` in `backends/.env` or systemd, matching the script output.

## Endpoints

- **Ops / dashboards:** `GET /health` (liveness), `GET /api/status` (capabilities only — persistence mode, Firebase Admin / Resend / APK pipeline flags, **`admin_auth_enforced`** when `ENFORCE_ADMIN_AUTH` is on; no secrets)
- **Dashboard:** `GET /api/apps`, `GET /api/apps/:id/devices`, `GET /api/apps/:id/subscribers`, `GET /api/campaigns`, `POST /api/campaigns`, `GET /api/api-keys`, `GET /api/builds`, `GET /api/analytics/overview`
- **SDK:** `POST /sdk/init`, `POST /sdk/register-device`, `POST /sdk/heartbeat`, `POST /sdk/event`
- **Server:** `POST /push/send` (Bearer service key), `POST /push/track`

Use header `X-PC-App-Key: pk_…` on `/sdk/init` (see seeded apps from `GET /api/apps`).

## Hardening checks

```bash
npm run lint
npm run build
npm run test
```

## Prove APK output (needs `ANDROID_HOME`)

After installing the Android SDK (API 34 + build-tools 34.x):

```bash
export ANDROID_HOME=/path/to/Android/sdk
npm run e2e:assemble
```

Renders the template to a temp dir, runs `./gradlew assembleDebug`, asserts `app-debug.apk` exists. GitHub Actions runs this in `backend-ci` (`local-api-apk-e2e` job).
