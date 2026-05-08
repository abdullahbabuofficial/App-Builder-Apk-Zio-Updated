/**
 * WebView App Builder — runner.
 *
 * Orchestrates the build pipeline for a single `ApkBuild`:
 *   queued → building → success | failed
 *
 * The runner is intentionally a thin coordinator. It:
 *   1. Enforces a small concurrency cap (ZIP-only vs Gradle-heavy modes).
 *   2. Calls the template engine to render the project tree in memory.
 *   3. Stages the rendered files under `.builds/<id>/source/` on disk.
 *   4. Hands the entry list to the zipper to produce `.builds/<id>/source.zip`.
 *   5. Optionally runs Gradle (`assembleDebug` by default) when the host has
 *      JDK + Gradle/Android SDK — producing `app-debug.apk` alongside the ZIP.
 */

import { promises as fs, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ApkBuild, ApkZioStore, WebViewBuildConfig } from "../store.js";
import { renderTemplate, packageSlug } from "./template-engine.js";
import { writeZip } from "./zip.js";
import { buildBuildNotificationEmail, isResendConfigured, sendResendEmail } from "../resend.js";
import { isFirebaseAdminConfigured, sendFcmMulticast } from "../firebase-admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolves to <repo>/backends/local-api/.builds regardless of process cwd. */
export const BUILDS_DIR = path.resolve(__dirname, "..", "..", ".builds");

/**
 * ZIP-only staging can run several builds at once. Gradle APK builds are
 * CPU/RAM-heavy — default concurrency is 1 (override with
 * `APKZIO_MAX_CONCURRENT_GRADLE`, capped at 4).
 */
const MAX_CONCURRENT_ZIP_ONLY = 3;
const MAX_FILES_PER_BUILD = 200;

/** Only debug APKs — direct install / QA. Play Store release builds are out of scope for now. */
const ALLOWED_GRADLE_TASKS = new Set(["assembleDebug"]);

function resolvedGradleTask(): string {
  const raw = (process.env.APKZIO_GRADLE_TASK ?? "assembleDebug").trim();
  return ALLOWED_GRADLE_TASKS.has(raw) ? raw : "assembleDebug";
}

function gradleTimeoutMs(): number {
  const raw = process.env.APKZIO_GRADLE_TIMEOUT_MS;
  const n = raw ? Number.parseInt(raw, 10) : 20 * 60 * 1000;
  if (!Number.isFinite(n)) return 20 * 60 * 1000;
  const minMs = 2 * 60 * 1000;
  const maxMs = 120 * 60 * 1000;
  return Math.min(maxMs, Math.max(minMs, n));
}

function maxConcurrentGradleBuilds(): number {
  const raw = process.env.APKZIO_MAX_CONCURRENT_GRADLE;
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, n));
}

function gradleHeapJvmArg(): string {
  const v = (process.env.APKZIO_GRADLE_HEAP ?? "2g").trim();
  if (/^\d+[gGmM]$/.test(v)) return `-Xmx${v}`;
  return "-Xmx2g";
}

type BuildEnvironment = {
  enabled: boolean;
  hasJava: boolean;
  hasGradle: boolean;
  androidHome: string | null;
  reason: string;
};

let cachedEnv: BuildEnvironment | null = null;

/** Same template root the renderer uses — must contain `gradlew` + wrapper jar for portable builds. */
const BUNDLED_TEMPLATE_DIR = path.resolve(__dirname, "..", "..", "template");

/** Exposed for tests that toggle env vars affecting `_detectBuildEnvironment`. */
export function resetApkBuildEnvironmentCacheForTests(): void {
  cachedEnv = null;
}

/** Parse `gradle --version` stdout; require at least AGP-compatible Gradle (8.7+). */
export function gradleVersionMeetsMinimum(
  stdout: string,
  minMajor: number,
  minMinor: number,
): boolean {
  const m = /Gradle\s+(\d+)\.(\d+)/.exec(stdout);
  if (!m) return false;
  const major = Number.parseInt(m[1], 10);
  const minor = Number.parseInt(m[2], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return false;
  if (major > minMajor) return true;
  if (major === minMajor && minor >= minMinor) return true;
  return false;
}

function bundledGradleWrapperPresent(): boolean {
  const gw = path.join(BUNDLED_TEMPLATE_DIR, "gradlew");
  const jar = path.join(BUNDLED_TEMPLATE_DIR, "gradle", "wrapper", "gradle-wrapper.jar");
  try {
    return statSync(gw).isFile() && statSync(jar).isFile();
  } catch {
    return false;
  }
}

function systemGradleMeetsAgpMinimum(): boolean {
  try {
    const r =
      process.platform === "win32"
        ? spawnSync("cmd.exe", ["/c", "gradle", "--version"], {
            encoding: "utf8",
            windowsHide: true,
          })
        : spawnSync("gradle", ["--version"], { encoding: "utf8" });
    if (r.status !== 0 || typeof r.stdout !== "string") return false;
    return gradleVersionMeetsMinimum(r.stdout, 8, 7);
  } catch {
    return false;
  }
}

function hostCanRunGradleApkBuild(): boolean {
  return bundledGradleWrapperPresent() || systemGradleMeetsAgpMinimum();
}

/**
 * Detect whether the host can run `./gradlew assembleDebug` (or Gradle 8.7+) and
 * whether APK builds are enabled. Cached for the process lifetime.
 */
function _detectBuildEnvironment(): BuildEnvironment {
  if (cachedEnv) return cachedEnv;

  const hasJava = probeTool("java", ["-version"]);
  const hasGradle = hostCanRunGradleApkBuild();
  const androidHomeRaw =
    process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? "";
  const androidHome = androidHomeRaw.trim() ? androidHomeRaw.trim() : null;

  const flag = (process.env.APKZIO_ENABLE_APK_BUILD ?? "").trim();

  /** ZIP-only when `0`; force attempt when `1`; when unset, auto-enable APK if JDK+Gradle+SDK look usable. */
  let optedIn: boolean;
  let reason = "";

  if (flag === "0") {
    optedIn = false;
    reason = "APKZIO_ENABLE_APK_BUILD=0 (ZIP-only)";
  } else if (flag === "1") {
    optedIn = true;
    if (!hasJava) reason = "java not on PATH";
    else if (!hasGradle) {
      reason =
        "Gradle 8.7+ not found on PATH and bundled template wrapper missing (gradlew / gradle-wrapper.jar)";
    } else if (!androidHome) reason = "ANDROID_HOME / ANDROID_SDK_ROOT is empty";
  } else {
    optedIn = hasJava && hasGradle && !!androidHome;
    if (!optedIn) {
      reason =
        "APK auto-disabled: need JDK, ANDROID_HOME, and Gradle 8.7+ or bundled gradlew wrapper";
    }
  }

  const enabled = optedIn && hasJava && hasGradle && !!androidHome;
  cachedEnv = { enabled, hasJava, hasGradle, androidHome, reason };
  return cachedEnv;
}

/** Safe summary for `GET /api/status` (no paths or secrets). */
export function getApkBuildCapabilitySummary(): {
  enabled: boolean;
  reason: string;
  java: boolean;
  gradle: boolean;
  android_sdk: boolean;
  gradle_task: string;
  gradle_timeout_ms: number;
  max_concurrent_gradle: number;
} {
  const e = _detectBuildEnvironment();
  return {
    enabled: e.enabled,
    reason: e.reason,
    java: e.hasJava,
    gradle: e.hasGradle,
    android_sdk: Boolean(e.androidHome),
    gradle_task: resolvedGradleTask(),
    gradle_timeout_ms: gradleTimeoutMs(),
    max_concurrent_gradle: maxConcurrentGradleBuilds(),
  };
}

/**
 * Cross-platform exit-code probe for a CLI tool. On Windows the bare command
 * names go through `cmd.exe /c <tool> <args>` so PATHEXT-resolved binaries
 * (java.exe, gradle.bat) are found the same way an interactive shell would.
 */
function probeTool(tool: string, args: string[]): boolean {
  try {
    if (process.platform === "win32") {
      const r = spawnSync("cmd.exe", ["/c", tool, ...args], {
        stdio: "ignore",
        windowsHide: true,
      });
      return r.status === 0;
    }
    const r = spawnSync(tool, args, { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

export class BuildRunner {
  private active = 0;
  private readonly waiting: string[] = [];
  private readonly notified = new Set<string>();

  constructor(private readonly store: ApkZioStore) {}

  /**
   * Kick off a build. Always returns synchronously — the actual work is
   * scheduled on the macrotask queue so the HTTP handler can respond fast.
   */
  startBuild(buildId: string): void {
    const build = this.store.getBuildById(buildId);
    if (!build) return;
    this.store.appendBuildLog(buildId, "Queued · waiting for capacity");
    const cap = _detectBuildEnvironment().enabled
      ? maxConcurrentGradleBuilds()
      : MAX_CONCURRENT_ZIP_ONLY;
    if (this.active >= cap) {
      this.waiting.push(buildId);
      this.store.appendBuildLog(
        buildId,
        `Queued · awaiting slot (position ${this.waiting.length})`,
      );
      return;
    }
    this.runNext(buildId);
  }

  private runNext(buildId: string): void {
    this.active += 1;
    setImmediate(() => {
      this.execute(buildId).finally(() => {
        this.active = Math.max(0, this.active - 1);
        const next = this.waiting.shift();
        if (next) this.runNext(next);
      });
    });
  }

  private async execute(buildId: string): Promise<void> {
    const startedAtMs = Date.now();
    try {
      const build = this.store.getBuildById(buildId);
      if (!build) return;

      this.store.setBuildStatus(buildId, "building");
      this.store.appendBuildLog(buildId, "Building · staging template");

      const config = this.resolveConfig(build);
      this.store.setBuildResult(buildId, { config });

      this.store.appendBuildLog(buildId, "Validating config");
      this.validateConfig(config);

      const rendered = await renderTemplate({
        config,
        versionCode: build.version_code,
        versionName: build.version_name,
      });

      if (rendered.files.length === 0) {
        throw new Error("template produced no files");
      }
      if (rendered.files.length > MAX_FILES_PER_BUILD) {
        throw new Error(
          `template too large (${rendered.files.length} > ${MAX_FILES_PER_BUILD})`,
        );
      }

      this.store.appendBuildLog(
        buildId,
        `Cloning template (${rendered.files.length} files)`,
      );

      const slug = packageSlug(config.package_name);
      const buildRoot = path.join(BUILDS_DIR, buildId);
      const sourceDir = path.join(buildRoot, "source");
      this.assertContained(sourceDir);

      await fs.rm(buildRoot, { recursive: true, force: true });
      await fs.mkdir(sourceDir, { recursive: true });

      this.store.appendBuildLog(
        buildId,
        `Renaming package to ${config.package_name}`,
      );

      let textFiles = 0;
      for (const file of rendered.files) {
        const target = path.join(sourceDir, file.path);
        this.assertContained(target, sourceDir);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, file.content);
        if (file.isText) textFiles += 1;
      }

      this.store.appendBuildLog(
        buildId,
        `Substituting tokens (${textFiles} text file${textFiles === 1 ? "" : "s"})`,
      );

      const gradlewPath = path.join(sourceDir, "gradlew");
      await fs.chmod(gradlewPath, 0o755).catch(() => undefined);

      this.store.appendBuildLog(buildId, "Writing source.zip");
      const zipPath = path.join(buildRoot, "source.zip");
      this.assertContained(zipPath);
      const { size } = await writeZip(rendered.files, zipPath, `${slug}-android`);

      const sourceZipUrl = `/artifacts/${buildId}/source.zip`;

      // ZIP is the always-on deliverable; mark the build a success now so a
      // crash inside the optional Gradle pass below cannot demote it.
      this.store.setBuildResult(buildId, {
        status: "success",
        size_bytes: size,
        output_url: sourceZipUrl,
        source_zip_url: sourceZipUrl,
        build_completed_at: new Date().toISOString(),
        duration_ms: Math.max(1, Date.now() - startedAtMs),
      });
      this.store.appendBuildLog(buildId, `Build complete · ${size} bytes`);
      this.maybeNotifyBuild(buildId, "success");

      await this.maybeBuildApk({
        buildId,
        projectDir: sourceDir,
      });

      const completedAt = new Date();
      const durationMs = Math.max(1, completedAt.getTime() - startedAtMs);
      this.store.setBuildResult(buildId, {
        build_completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const completedAt = new Date();
      const durationMs = Math.max(1, completedAt.getTime() - startedAtMs);
      this.store.setBuildResult(buildId, {
        status: "failed",
        size_bytes: null,
        output_url: null,
        source_zip_url: null,
        duration_ms: durationMs,
        build_completed_at: completedAt.toISOString(),
      });
      this.store.appendBuildLog(buildId, `Error: ${message}`);
      this.maybeNotifyBuild(buildId, "failed");
    }
  }

  private maybeNotifyBuild(buildId: string, status: "success" | "failed"): void {
    if (this.notified.has(buildId)) return;
    const build = this.store.getBuildById(buildId);
    if (!build || !build.user_id) return;
    const user = this.store.findUserById(build.user_id);
    if (!user) return;
    const config = (build.config ?? {}) as Record<string, unknown>;
    const appName =
      this.store.apps.get(build.app_id)?.name ??
      (typeof config.app_name === "string" ? String(config.app_name) : "ApkZio App");
    let didNotify = false;

    if (isResendConfigured()) {
      const email = buildBuildNotificationEmail({
        to: user.email,
        status,
        appName,
        versionName: build.version_name,
        versionCode: build.version_code,
        artifactPath: build.output_url ?? build.source_zip_url ?? null,
      });
      didNotify = true;
      void sendResendEmail(email).catch(() => undefined);
    }

    if (isFirebaseAdminConfigured()) {
      const tokens = this.store.listUserPushTokens(user.id);
      if (tokens.length > 0) {
        didNotify = true;
        const title = status === "success" ? "Build completed" : "Build failed";
        const body = `${appName} · v${build.version_name} (${build.version_code})`;
        void sendFcmMulticast({
          tokens,
          title,
          body,
          data: { kind: "build", build_id: build.id, status },
        }).catch(() => undefined);
      }
    }

    if (didNotify) this.notified.add(buildId);
  }

  /**
   * Best-effort Gradle APK pass (`APKZIO_GRADLE_TASK`, default `assembleDebug`).
   * Runs when the host has JDK + Gradle + ANDROID_HOME and APK builds are not
   * disabled. Failures NEVER demote the build status — source.zip is already success.
   */
  private async maybeBuildApk(args: {
    buildId: string;
    projectDir: string;
  }): Promise<void> {
    const { buildId, projectDir } = args;
    const env = _detectBuildEnvironment();
    const task = resolvedGradleTask();

    if (!env.enabled) {
      const flag = (process.env.APKZIO_ENABLE_APK_BUILD ?? "").trim();
      const hint =
        flag === "0"
          ? "APK pipeline disabled (APKZIO_ENABLE_APK_BUILD=0)."
          : flag === "1"
            ? `Cannot run Gradle here (${env.reason}). Source ZIP is ready.`
            : `APK not built (${env.reason}). Source ZIP is ready.`;
      this.store.appendBuildLog(buildId, `APK build skipped · ${hint}`);
      this.store.setBuildResult(buildId, {
        apk_build_skipped: true,
        apk_url: null,
        apk_size_bytes: null,
        apk_build_error: null,
      });
      return;
    }

    this.store.appendBuildLog(
      buildId,
      `[gradle] starting ${task} (cwd=${path.basename(projectDir)})`,
    );

    const exit = await this.runGradleApkTask(buildId, projectDir, task);
    const timeoutMin = Math.max(1, Math.round(gradleTimeoutMs() / 60_000));

    if (exit.kind === "timeout") {
      this.store.appendBuildLog(
        buildId,
        `Gradle timed out after ${timeoutMin} minute(s) (APKZIO_GRADLE_TIMEOUT_MS)`,
      );
      this.store.appendBuildLog(
        buildId,
        "APK build failed; download source.zip and build locally.",
      );
      this.store.setBuildResult(buildId, {
        apk_build_skipped: false,
        apk_build_error: "timeout",
        apk_url: null,
        apk_size_bytes: null,
      });
      return;
    }

    if (exit.kind === "error" || exit.code !== 0) {
      const reason =
        exit.kind === "error" ? exit.message : `exit ${exit.code}`;
      this.store.appendBuildLog(
        buildId,
        "APK build failed; download source.zip and build locally.",
      );
      this.store.setBuildResult(buildId, {
        apk_build_skipped: false,
        apk_build_error: reason,
        apk_url: null,
        apk_size_bytes: null,
      });
      return;
    }

    const built = await this.resolveBuiltApk(projectDir, task);
    if (!built) {
      this.store.appendBuildLog(
        buildId,
        "APK build failed; download source.zip and build locally.",
      );
      this.store.setBuildResult(buildId, {
        apk_build_skipped: false,
        apk_build_error: "apk not produced",
        apk_url: null,
        apk_size_bytes: null,
      });
      return;
    }

    const apkDest = path.join(BUILDS_DIR, buildId, built.artifactBase);
    this.assertContained(apkDest);
    await fs.copyFile(built.src, apkDest);
    const apkStat = await fs.stat(apkDest);
    this.store.setBuildResult(buildId, {
      apk_url: `/artifacts/${buildId}/${built.artifactBase}`,
      apk_size_bytes: apkStat.size,
      apk_build_skipped: false,
      apk_build_error: null,
    });
    this.store.appendBuildLog(buildId, `APK ready · ${apkStat.size} bytes`);
  }

  /** Prefer Gradle wrapper when present in the staged project. */
  private async resolveGradleInvocation(
    projectDir: string,
    gradleArgs: string[],
  ): Promise<{ cmd: string; args: string[] }> {
    const isWin = process.platform === "win32";
    const unixWrapper = path.join(projectDir, "gradlew");
    const winWrapper = path.join(projectDir, "gradlew.bat");
    if (isWin) {
      try {
        const st = await fs.stat(winWrapper);
        if (st.isFile()) {
          return { cmd: "cmd.exe", args: ["/c", "gradlew.bat", ...gradleArgs] };
        }
      } catch {
        /* no wrapper */
      }
      return { cmd: "cmd.exe", args: ["/c", "gradle", ...gradleArgs] };
    }
    try {
      const st = await fs.stat(unixWrapper);
      if (st.isFile()) {
        return { cmd: unixWrapper, args: gradleArgs };
      }
    } catch {
      /* no wrapper */
    }
    return { cmd: "gradle", args: gradleArgs };
  }

  private async resolveBuiltApk(
    projectDir: string,
    _task: string,
  ): Promise<{ src: string; artifactBase: string } | null> {
    const p = path.join(
      projectDir,
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk",
    );
    const st = await fs.stat(p).catch(() => null);
    if (!st?.isFile()) return null;
    return { src: p, artifactBase: "app-debug.apk" };
  }

  /**
   * Spawn Gradle (or `./gradlew`) and stream output into the per-build log.
   */
  private async runGradleApkTask(
    buildId: string,
    projectDir: string,
    task: string,
  ): Promise<
    | { kind: "exit"; code: number }
    | { kind: "timeout" }
    | { kind: "error"; message: string }
  > {
    const gradleArgs = [task, "--no-daemon"];
    const inv = await this.resolveGradleInvocation(projectDir, gradleArgs);
    const heap = gradleHeapJvmArg();
    const prev = (process.env.JAVA_TOOL_OPTIONS ?? "").trim();
    const javaTool = [prev, heap].filter(Boolean).join(" ");

    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(inv.cmd, inv.args, {
          cwd: projectDir,
          env: { ...process.env, JAVA_TOOL_OPTIONS: javaTool },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        resolve({ kind: "error", message });
        return;
      }

      let settled = false;
      let lastBlank = false;
      const emit = (chunk: string) => {
        for (const raw of chunk.split(/\r?\n/)) {
          const line = raw.replace(/\s+$/, "");
          if (!line) {
            if (lastBlank) continue;
            lastBlank = true;
            continue;
          }
          lastBlank = false;
          this.store.appendBuildLog(buildId, `[gradle] ${line}`);
        }
      };

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (d: string) => emit(d));
      child.stderr?.on("data", (d: string) => emit(d));

      const timer = setTimeout(() => {
        if (settled) return;
        try {
          child.kill("SIGKILL");
        } catch {
          /* swallow — child may already be gone */
        }
        if (settled) return;
        settled = true;
        resolve({ kind: "timeout" });
      }, gradleTimeoutMs());

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: "error", message: err.message });
      });

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: "exit", code: code ?? -1 });
      });
    });
  }

  /**
   * Build the effective `WebViewBuildConfig` from whatever the caller supplied
   * on the build row, falling back to sensible defaults derived from the
   * parent app row + template defaults.
   */
  private resolveConfig(build: ApkBuild): WebViewBuildConfig {
    const supplied = build.config ?? null;
    const app = this.store.apps.get(build.app_id);
    const fallbackName = app?.name ?? "WebView App";
    const fallbackPkg =
      app?.package_name && app.package_name.includes(".")
        ? app.package_name
        : `com.apkzio.${slugify(fallbackName)}`;

    const merged: WebViewBuildConfig = {
      app_name: pickString(supplied?.app_name, fallbackName),
      package_name: normalisePackage(pickString(supplied?.package_name, fallbackPkg)),
      start_url: pickString(supplied?.start_url, "https://example.com/"),
      primary_color: pickHex(supplied?.primary_color, "#CDFF3F"),
      background_color: pickHex(supplied?.background_color, "#0B0F0E"),
      splash_color: pickHex(supplied?.splash_color, "#0B0F0E"),
      allow_file_uploads: supplied?.allow_file_uploads ?? true,
      allow_geolocation: supplied?.allow_geolocation ?? false,
      allow_camera: supplied?.allow_camera ?? false,
      pull_to_refresh: supplied?.pull_to_refresh ?? true,
      swipe_back: supplied?.swipe_back ?? true,
      offline_message: pickString(
        supplied?.offline_message,
        "You're offline. Reconnect to load this app.",
      ),
      release_notes: supplied?.release_notes ?? "",
    };
    return merged;
  }

  private validateConfig(c: WebViewBuildConfig): void {
    if (!c.app_name.trim()) throw new Error("app_name is required");
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(c.package_name)) {
      throw new Error(`package_name "${c.package_name}" is not a valid Java package`);
    }
    if (!/^https?:\/\//i.test(c.start_url)) {
      throw new Error(`start_url must be http(s) URL: "${c.start_url}"`);
    }
  }

  /**
   * Refuse to write outside of `<localApiRoot>/.builds/`. Prevents path
   * traversal from a malicious package_name (e.g. one that resolves to `..`).
   */
  private assertContained(target: string, base = BUILDS_DIR): void {
    const resolvedBase = path.resolve(base);
    const resolvedTarget = path.resolve(target);
    if (
      resolvedTarget !== resolvedBase &&
      !resolvedTarget.startsWith(resolvedBase + path.sep)
    ) {
      throw new Error(`refused write outside build dir: ${target}`);
    }
  }
}

function pickString(value: string | undefined | null, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function pickHex(value: string | undefined | null, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32) || "app"
  );
}

function normalisePackage(pkg: string): string {
  return pkg.trim().replace(/[^a-z0-9_.]+/gi, "").replace(/\.+/g, ".");
}
