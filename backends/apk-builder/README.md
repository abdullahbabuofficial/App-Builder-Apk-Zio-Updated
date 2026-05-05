# PushCare APK builder

Queue worker that drains rows from the `apk_builds` table and produces
signed APKs for customer apps. **This is the simulated v1**: it does
not yet run Gradle. It produces a real ZIP file shaped like an APK so
the rest of the pipeline (queue claim, status updates, storage upload,
download URL) can be exercised end-to-end while the Gradle integration
is being built out.

## Architecture

```
apk_builds (pending) ── claim ──▶ buildApk() ──▶ uploadApk() ──▶ apk_builds (succeeded)
                       FOR UPDATE       (simulated)     Supabase Storage
                       SKIP LOCKED                      / OUTPUT_DIR / /tmp
```

* `src/index.ts`     – worker bootstrap, healthz on `:8090`, SIGTERM drain.
* `src/db.ts`        – Postgres claim/update (FOR UPDATE SKIP LOCKED).
* `src/api-client.ts` – Local-API fallback for `npm run dev`.
* `src/builder.ts`   – the simulated build. **The clean seam to swap in real Gradle lives here** — see the `SEAM` comment block above the `archiver` call.
* `src/storage.ts`   – Supabase Storage uploader with local-disk fallback.

## Run locally against backends/local-api

```bash
cp .env.example .env
# Edit .env: comment out DATABASE_URL, set LOCAL_API_URL=http://localhost:8787
npm install
npm run dev
```

The worker will poll `GET /api/builds`, claim queued rows, and write
fake APKs to `/tmp/<build_id>.apk` (or `OUTPUT_DIR` if set).

## Deploy to Cloud Run / Fly

The Dockerfile is multi-stage and ready to ship.

```bash
docker build -t pushcare-apk-builder .
```

Required env in production:

* `DATABASE_URL`               — direct Supabase Postgres URL.
* `SUPABASE_URL`               — for the storage upload.
* `SUPABASE_SERVICE_ROLE_KEY`  — for the storage upload.

Optional:

* `WORKER_CONCURRENCY` (default `2`)
* `POLL_INTERVAL_MS`   (default `5000`)
* `PG_POOL_MAX`        (default `3`)

## Replacing the simulated build with real Gradle

Find the `// SEAM:` comment block in `src/builder.ts`. The four steps
listed there (assembleRelease → v2 sign → zipalign → return apkPath)
are everything the surrounding code expects. The queue, status
updates, storage upload, and sha256 calculation all stay the same.
