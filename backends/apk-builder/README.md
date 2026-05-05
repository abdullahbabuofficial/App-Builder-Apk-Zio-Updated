# PushCare APK builder

Queue worker that drains rows from the `apk_builds` table and produces
signed APKs for customer apps. Two build modes, gated by `APK_BUILD_MODE`:

| Mode | What it does | When to use |
|---|---|---|
| `simulated` (default) | Produces a real ZIP shaped like an APK so the rest of the pipeline (queue claim, status updates, storage upload, download URL) can be exercised end-to-end. **No Gradle.** | Local dev, CI, demoing the dashboard. |
| `gradle` | Copies `templates/android-app/` into a per-build workdir, substitutes placeholders, runs `bash gradlew assembleRelease`, returns the resulting APK. | Production / when you actually want installable APKs. |

Both paths return the same `BuildResult` shape; the wrapping code stays
identical.

## Architecture

```
apk_builds (pending) ── claim ──▶ buildApk() ──▶ uploadApk() ──▶ apk_builds (succeeded)
                       FOR UPDATE       sim/gradle    Supabase Storage
                       SKIP LOCKED                    / OUTPUT_DIR / /tmp
                                          │
                                          └─▶ uploadBuildLog() ─▶ apk_builds.build_log_url
```

* `src/index.ts`     – worker bootstrap, healthz on `:8090`, SIGTERM drain.
* `src/db.ts`        – Postgres claim/update (FOR UPDATE SKIP LOCKED).
* `src/api-client.ts` – Local-API fallback for `npm run dev`.
* `src/builder.ts`   – `runSimulatedBuild()` and `runGradleBuild()`.
* `src/storage.ts`   – Supabase Storage uploader with local-disk fallback. Uploads APKs and build logs.
* `templates/android-app/` – minimal real Android Studio project that the gradle path templates per build.

## Run locally against backends/local-api

```bash
cp .env.example .env
# Edit .env: comment out DATABASE_URL, set LOCAL_API_URL=http://localhost:8787
npm install
npm run dev
```

The worker polls `GET /api/builds?status=queued&limit=1`, PATCHes the row
to `building`, runs the build (simulated by default), and POSTs the
result to `POST /api/builds/:id/result` with the captured log inline.

The dashboard's APK Builder page picks up the new state on its next
refresh; click any row to open `/builder/:id` and watch the build log
auto-refresh every 3s while it's in flight.

## Modes

### Simulated mode (default)

Set nothing or `APK_BUILD_MODE=simulated`. The worker produces a real
ZIP file with a manifest, a `pushcare/build.json` describing the build
context, and a notice file. The output is recognized as an APK by the
admin UI but is NOT installable.

### Gradle mode

Set `APK_BUILD_MODE=gradle`. The worker:

1. Copies `templates/android-app/` into `/tmp/pushcare-build-<id>/`.
2. Substitutes placeholders from `apk_builds.build_config` (see below).
3. Relocates Kotlin sources from `io/pushcare/template/` to a directory tree matching the resolved package name (AGP requires this).
4. `chmod +x gradlew && bash gradlew assembleRelease`.
5. Streams stdout+stderr line-by-line into the build log buffer.
6. Locates `app/build/outputs/apk/release/app-release.apk` (or `app-release-unsigned.apk`), copies it to `/tmp/<build_id>.apk`, and returns it.

#### Prerequisites for gradle mode

Each builder pod needs:

* JDK 17 on `PATH`.
* Android SDK with **platform 34** + **build-tools 34**, with `ANDROID_HOME` set.
* Gradle 8.7+ on `PATH` (the bundled `gradlew` shim is a thin wrapper that runs the host's gradle — there is no `gradle-wrapper.jar` in source control).
* Network egress to `dl.google.com`, `repo.maven.apache.org`, `services.gradle.org` (or a configured Artifactory mirror).

For Cloud Run / Fly: build a custom image based on `eclipse-temurin:17-jdk` plus the cmdline-tools archive. Cache `~/.gradle` and `$ANDROID_HOME/build-cache` between builds — otherwise every build redownloads ~500 MB.

## Templating placeholders

The gradle path replaces these in every `*.kts`, `*.kt`, `*.xml`,
`*.java`, `*.gradle`, `*.properties` file under the workdir:

| Placeholder | Source | Fallback |
|---|---|---|
| `__PUSHCARE_APP_KEY__` | `build_config.app_key` | `pk_<48 zeros>` |
| `__PUSHCARE_PACKAGE_NAME__` | `build_config.package_name` | `io.pushcare.app<8 chars of app_id>` |
| `__PUSHCARE_APP_NAME__` | `build_config.app_name` | `PushCare App` |
| `__PUSHCARE_VERSION_NAME__` | `version_name` | `0.0.1` |
| `__PUSHCARE_VERSION_CODE__` | `version_code` | `1` |
| `__PUSHCARE_API_BASE__` | `build_config.api_base` | `https://api.pushcare.net` |

## Signing

The default template does NOT ship with a keystore in source control —
`templates/android-app/keystores/debug.jks.placeholder` is a text file
documenting the omission.

To produce signed release APKs, drop a JKS at `<workdir>/keystores/release.jks`
and set:

* `PUSHCARE_KEYSTORE_PASSWORD`
* `PUSHCARE_KEY_ALIAS`
* `PUSHCARE_KEY_PASSWORD`

For per-tenant signing, stage the keystore from `apk_builds.build_config.signing_keystore`
in the worker before invoking gradle. (Future enhancement — currently
all builds use the worker-level keystore if any.)

If no keystore is present, gradle produces `app-release-unsigned.apk`,
and the builder returns that. The admin UI will still surface a download
link — the user can sign locally with `apksigner`.

## Deploy

```bash
docker build -t pushcare-apk-builder .
```

Required env in production:

* `DATABASE_URL`               — direct Supabase Postgres URL.
* `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — for storage uploads (APK + log).

Optional:

* `APK_BUILD_MODE`     (default `simulated`)
* `APK_TEMPLATE_DIR`   (default `<repo>/backends/apk-builder/templates/android-app`)
* `WORKER_CONCURRENCY` (default `2`)
* `POLL_INTERVAL_MS`   (default `5000`)
* `PG_POOL_MAX`        (default `3`)
* `OUTPUT_DIR`         — for local-disk APK + log fallback when Supabase is not configured.
