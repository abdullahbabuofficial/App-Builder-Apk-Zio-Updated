# PushCare Android template

Minimal Android project the apk-builder templates per build. Placeholders
look like `__PUSHCARE_*__` and are replaced from `apk_builds.build_config`
by `runGradleBuild()` in `src/builder.ts`.

* `app/`                           — single-activity app, FCM service.
* `app/src/main/java/io/pushcare/template/PushCareInit.kt` — SDK init.
* `app/src/main/java/io/pushcare/template/PushCareMessagingService.kt` — FCM.
* `gradlew` / `gradlew.bat`        — shim that delegates to host `gradle`
                                     (no wrapper jar in source control).
* `gradle/wrapper/gradle-wrapper.properties` — pin to Gradle 8.7.
* `keystores/`                     — drop a `release.jks` here per tenant
                                     before `assembleRelease`. We never
                                     ship a real key in this repo.

After templating, the worker runs `chmod +x gradlew && bash gradlew
assembleRelease`. Output APK lands at
`app/build/outputs/apk/release/app-release(-unsigned)?.apk`.
