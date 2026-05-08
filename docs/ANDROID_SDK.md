# Apkzio Android SDK

Minimal Kotlin library for calling Apkzio Supabase Edge SDK routes from Android apps.

## Location in repo

| Path | Purpose |
|------|---------|
| [`sdk/android/`](../sdk/android/) | Standalone Gradle project (`settings.gradle.kts`, wrapper). |
| [`sdk/android/apkzio-sdk/`](../sdk/android/apkzio-sdk/) | Library module (`com.apkzio.sdk`). |
| [`sdk/android/apkzio-sdk/README.md`](../sdk/android/apkzio-sdk/README.md) | Integration snippet, ProGuard, Maven placeholder. |

## Base URL

Edge functions are invoked under the Supabase **functions v1** prefix:

```text
https://<project-ref>.supabase.co/functions/v1
```

Pass this string as `baseUrl` to `ApkzioClient`. Paths appended by the SDK are:

| Client method | HTTP | Notes |
|---------------|------|--------|
| `init(...)` | `POST .../sdk-init` | Requires `X-PC-App-Key`; body: `android_id`, optional `fcm_token`, device attrs (see [`sdk-init`](../supabase/functions/sdk-init/index.ts)). |
| `registerDevice(...)` | `POST .../sdk-register-device` | App key + `device_id`, `fcm_token`. |
| `heartbeat(...)` | `POST .../sdk-heartbeat` | Body: `app_id`, `device_id` (UUIDs). Optional `session_id`, `app_version`, `country_code`. |
| `event(...)` / `eventBatch(...)` | `POST .../sdk-event` | Batch JSON array `events[]` or single-event fields server-side; client uses batch shape. |
| `track(...)` | `POST .../push-track` | `notification_id`, `device_id`, `event`: `delivered` \| `opened` \| `clicked`. |

Some docs and smoke examples use shortened hosts (e.g. `https://<ref>.functions.supabase.co/...`). Prefer the `supabase.co/functions/v1/<function-name>` form unless your project uses a custom Functions domain.

## Publishing / Maven coordinates (optional)

The SDK is currently consumed from source; no artifacts are published yet. Placeholder coordinates once Maven Central or GitHub Packages wiring is enabled: `com.apkzio:sdk:0.1.0`.

Gradle consumer example (when artifacts are available or when you publish locally):

```kotlin
repositories {
    mavenCentral()
    // GitHub Packages once configured for this repo:
    maven { url = uri("https://maven.pkg.github.com/apkzio/apkzio") }
    // For local test publishes (see `build.gradle.kts`):
    mavenLocal()
}

dependencies {
    implementation("com.apkzio:sdk:0.1.0")
}
```

`sdk/android/apkzio-sdk/build.gradle.kts` includes an opt-in `publishing` block guarded by `MAVEN_PUBLISH` and `PUBLISH_LOCAL`. Set both to `true` to publish `components["release"]` to a local repository under `apkzio-sdk/build/repo` without requiring signing or remote credentials. Assemble remains unaffected when the env vars are unset.

## Headers

| Header | When |
|--------|------|
| `Content-Type: application/json` | All requests. |
| `X-PC-App-Key` | `init`, `register-device` (must match `pk_<48 hex>`; see `extractAppKey` in [`_shared/utils.ts`](../supabase/functions/_shared/utils.ts)). |
| `X-PC-Device-ID` | `register-device`, `heartbeat`, `event` / `eventBatch`, `track` — mirrors persisted device UUID (body remains canonical). |

`sdk-heartbeat`, `sdk-event`, and `push-track` do **not** require app key on the server today; the SDK still sends `X-PC-Device-ID` where applicable.

## JSON contracts (reference)

Authoritative field lists:

- Init: [`supabase/functions/sdk-init/index.ts`](../supabase/functions/sdk-init/index.ts) (`InitBody`).
- Register device: [`sdk-register-device/index.ts`](../supabase/functions/sdk-register-device/index.ts).
- Heartbeat: [`sdk-heartbeat/index.ts`](../supabase/functions/sdk-heartbeat/index.ts).
- Events / batch: [`sdk-event/index.ts`](../supabase/functions/sdk-event/index.ts).
- Push engagement: [`push-track/index.ts`](../supabase/functions/push-track/index.ts).

## Storage

Default implementation persists `device_id` and `app_id` after successful `init()` via [`SharedPreferencesApkzioStorage`](../sdk/android/apkzio-sdk/src/main/kotlin/com/apkzio/sdk/SharedPreferencesApkzioStorage.kt). Implement [`ApkzioStorage`](../sdk/android/apkzio-sdk/src/main/kotlin/com/apkzio/sdk/ApkzioStorage.kt) to plug in your own store.

## Heartbeat scheduling (WorkManager sample)

For background liveness, aim for ~45–60s between heartbeats while respecting OEM battery policies. On stricter devices, consider foreground service mode or widening the interval to avoid throttling. WorkManager’s true periodic jobs enforce a 15-minute minimum; to stay near 45–60s, chain `OneTimeWorkRequest` instances with a short `initialDelay` and enqueue the next run after each success.

Example `CoroutineWorker` (add the WorkManager dependency in your app module if you do not already use it):

```kotlin
class HeartbeatWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    private val storage = SharedPreferencesApkzioStorage(appContext)
    private val client = ApkzioClient(
        appKey = BuildConfig.APKZIO_APP_KEY,
        baseUrl = BuildConfig.APKZIO_BASE_URL,
        storage = storage,
    )

    override suspend fun doWork(): Result = suspendCancellableCoroutine { cont ->
        if (storage.deviceId == null || storage.appId == null) {
            cont.resume(Result.retry()) {}
            return@suspendCancellableCoroutine
        }

        client.heartbeat(appVersion = BuildConfig.VERSION_NAME) { result ->
            cont.resume(
                result.fold(
                    onSuccess = { Result.success() },
                    onFailure = { Result.retry() },
                ),
            ) {}
        }
    }
}
```

Scheduling loop (approx. 1 minute cadence; adjust as needed):

```kotlin
val work = OneTimeWorkRequestBuilder<HeartbeatWorker>()
    .setInitialDelay(1, TimeUnit.MINUTES)
    .build()

WorkManager.getInstance(context).enqueueUniqueWork(
    "apkzio-heartbeat",
    ExistingWorkPolicy.REPLACE,
    work,
)
```

Inside `HeartbeatWorker`, you can enqueue the next run after `Result.success()` to maintain cadence. Handle device idle/doze and OEM restrictions per your product’s battery expectations.

## CI

GitHub Actions (optional): [`.github/workflows/android-sdk-ci.yml`](../.github/workflows/android-sdk-ci.yml) runs `./gradlew :apkzio-sdk:assembleRelease` on `sdk/android/**` changes.

## Production checklist (client)

- [ ] JWT / API-key contract documented per route (SDK routes use app key + device UUIDs as above).
- [ ] Production `baseUrl` pinned; no `localhost` in release builds.
- [ ] Crash and network failure handling with backoff for heartbeat/events.
- [ ] Play policy / data disclosures aligned with event payloads and attrs sent from `init`.
