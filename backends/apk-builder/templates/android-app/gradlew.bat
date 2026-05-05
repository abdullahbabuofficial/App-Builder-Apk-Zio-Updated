@rem Lightweight Windows wrapper. Delegates to the host's `gradle` binary.
@rem The full Gradle wrapper jar (gradle-wrapper.jar) is intentionally NOT
@rem shipped in source control — generate it once with
@rem `gradle wrapper --gradle-version 8.7` if you need offline builds.
@echo off
gradle %*
