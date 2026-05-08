# Production-oriented image: Node API + JDK 17 + Gradle + Android SDK (API 34).
# Intended for dedicated builders or single-host deploy where URL→APK must work.

FROM node:20-bookworm-slim

ARG ANDROID_COMMAND_LINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
ARG GRADLE_VERSION=8.10.2

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV GRADLE_VERSION=${GRADLE_VERSION}

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openjdk-17-jdk-headless \
    unzip \
    wget \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:/opt/gradle-${GRADLE_VERSION}/bin:${PATH}"

# Android command-line tools → sdkmanager (zip contains top-level `cmdline-tools/`)
RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
  && wget -q "${ANDROID_COMMAND_LINE_TOOLS_URL}" -O /tmp/cmdline-tools.zip \
  && unzip -q /tmp/cmdline-tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
  && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
  && rm -f /tmp/cmdline-tools.zip

# Non-interactive licenses + minimal SDK bits for AGP 8.5 / compileSdk 34 template builds
RUN yes | sdkmanager --sdk_root="${ANDROID_HOME}" --licenses >/dev/null \
  && sdkmanager --sdk_root="${ANDROID_HOME}" \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0"

RUN wget -q "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -O /tmp/gradle.zip \
  && unzip -q /tmp/gradle.zip -d /opt \
  && rm -f /tmp/gradle.zip

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

USER root
CMD ["node", "dist/server.js"]
