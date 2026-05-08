# Apkzio SDK (`apkzio-sdk`)

Kotlin Android library (minSdk **24**, compile/target **35**) using **OkHttp** only.

## Gradle — project dependency

From your app’s `settings.gradle.kts` (or `settings.gradle`), include the SDK project:

```kotlin
include(":apkzio-sdk")
project(":apkzio-sdk").projectDir = file("../path/to/apkzio/repo/sdk/android/apkzio-sdk")
```

In `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":apkzio-sdk"))
}
```

Adjust `projectDir` to match where you vendor or submodule this repo.

## Maven coordinates (optional)

Not published yet; keep vendoring from source until Maven Central or GitHub Packages is wired. Planned coordinates: `com.apkzio:sdk:0.1.0`.

Consumer snippet (once available, or for local test publishes):

```kotlin
repositories {
    mavenCentral()
    // GitHub Packages once configured:
    maven { url = uri("https://maven.pkg.github.com/apkzio/apkzio") }
    // For local test publishes:
    mavenLocal()
}

dependencies {
    implementation("com.apkzio:sdk:0.1.0")
}
```

`build.gradle.kts` includes an opt-in `publishing` block guarded by `MAVEN_PUBLISH` and `PUBLISH_LOCAL`. Set both to `true` before running `./gradlew :apkzio-sdk:publishReleasePublicationToMavenRepository` to drop artifacts into `apkzio-sdk/build/repo` without any signing/credential requirements. Assemble remains unchanged when the env vars are unset.

## Integration

```kotlin
val storage = SharedPreferencesApkzioStorage(applicationContext)
val client = ApkzioClient(
    appKey = BuildConfig.APKZIO_APP_KEY, // pk_<48 hex>
    baseUrl = BuildConfig.APKZIO_BASE_URL, // https://<ref>.supabase.co/functions/v1
    storage = storage,
)

// Cold start / install
client.init(
    androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        ?: UUID.randomUUID().toString(),
    fcmToken = fcmToken,
    appVersion = BuildConfig.VERSION_NAME,
    osVersion = Build.VERSION.RELEASE,
    sdkInt = Build.VERSION.SDK_INT,
    deviceModel = Build.MODEL,
    manufacturer = Build.MANUFACTURER,
) { result ->
    result.onSuccess { /* schedule heartbeat WorkManager using heartbeatIntervalSec */ }
}

// FCM onNewToken
client.registerDevice(newToken) { /* … */ }

client.heartbeat(appVersion = BuildConfig.VERSION_NAME) { /* … */ }

client.event("screen_view", mapOf("screen" to "home")) { /* … */ }

client.track(notificationId, PushEngagement.OPENED) { /* … */ }
```

Use `eventBatch` to flush up to 100 events per request.

## ProGuard / R8

Consumer rules are bundled via `consumer-rules.pro`. If you strip aggressively, keep:

```proguard
-keep class com.apkzio.sdk.** { *; }
```

## Build this module

From `sdk/android/`:

```bash
./gradlew :apkzio-sdk:assembleRelease
```

Requires Android SDK (set `ANDROID_HOME` or `local.properties` `sdk.dir=…`).
