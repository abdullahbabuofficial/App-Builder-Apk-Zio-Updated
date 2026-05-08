#!/usr/bin/env bash
# Install JDK 17, Gradle, and Android SDK components on Debian/Ubuntu hosts
# (bare metal or VM) so local-api can run assembleDebug without Docker.
#
# Usage:
#   sudo bash scripts/install-android-builder-host.sh
#
# After install, set in backends/.env:
#   export ANDROID_HOME=/opt/android-sdk
#   export ANDROID_SDK_ROOT=/opt/android-sdk
#   export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
GRADLE_VERSION="${GRADLE_VERSION:-8.10.2}"
CMDLINE_TOOLS_URL="${CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "error: run as root (sudo)" >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl openjdk-17-jdk-headless unzip wget

mkdir -p "${ANDROID_HOME}/cmdline-tools"
tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

wget -q "${CMDLINE_TOOLS_URL}" -O "${tmpdir}/cmdline-tools.zip"
unzip -q "${tmpdir}/cmdline-tools.zip" -d "${ANDROID_HOME}/cmdline-tools"
mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest"

export ANDROID_SDK_ROOT="${ANDROID_HOME}"
export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

# `yes` gets SIGPIPE when sdkmanager closes stdin — disable pipefail for this line only
set +o pipefail
yes | sdkmanager --sdk_root="${ANDROID_HOME}" --licenses >/dev/null
set -o pipefail
sdkmanager --sdk_root="${ANDROID_HOME}" \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0"

wget -q "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -O "${tmpdir}/gradle.zip"
unzip -q "${tmpdir}/gradle.zip" -d /opt
ln -sfn "/opt/gradle-${GRADLE_VERSION}/bin/gradle" /usr/local/bin/gradle

echo ""
echo "Installed SDK at ${ANDROID_HOME} and Gradle ${GRADLE_VERSION}."
echo "Add to backends/.env (or systemd Environment=):"
echo "  ANDROID_HOME=${ANDROID_HOME}"
echo "  ANDROID_SDK_ROOT=${ANDROID_HOME}"
echo "Ensure PATH includes: /opt/gradle-${GRADLE_VERSION}/bin and Android paths above."
