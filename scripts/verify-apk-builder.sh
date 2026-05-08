#!/usr/bin/env bash
# Quick offline checks: template includes Gradle wrapper, local-api tests pass.
# For a real APK you still need ANDROID_HOME + Java on the host (or Docker image).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TPL="$ROOT/backends/local-api/template"
test -f "$TPL/gradlew" || { echo "error: missing $TPL/gradlew" >&2; exit 1; }
test -f "$TPL/gradle/wrapper/gradle-wrapper.jar" || { echo "error: missing gradle-wrapper.jar" >&2; exit 1; }
cd "$ROOT/backends/local-api"
npm run lint
npm run build
npm test
echo "OK — template wrapper present; local-api tests passed."
if [[ -n "${ANDROID_HOME:-}" ]] || [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "ANDROID_* is set — run full APK proof: cd backends/local-api && npm run e2e:assemble"
else
  echo "Tip: with ANDROID_HOME + SDK 34, run: cd backends/local-api && npm run e2e:assemble"
fi
