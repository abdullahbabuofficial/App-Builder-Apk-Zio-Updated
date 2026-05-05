// apk-builder/src/builder.ts
//
// Two build modes, gated by APK_BUILD_MODE:
//   * `simulated` (default) — produces a real ZIP shaped like an APK so
//     the rest of the pipeline (queue claim, status updates, storage
//     upload, download URL) can be exercised end-to-end. No Gradle.
//   * `gradle` — copies templates/android-app/ into a per-build workdir,
//     substitutes placeholders, runs `bash gradlew assembleRelease`, and
//     returns the resulting APK. Requires JDK 17 + Android SDK + gradle
//     8.7+ on PATH.
//
// Both paths return the same BuildResult shape; the wrapping code in
// index.ts (uploadApk, markBuildSucceeded, …) stays identical.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fsp } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import type pino from 'pino';

export interface BuildContext {
  build_id: string;
  app_id: string;
  owner_id: string;
  version_name: string;
  version_code: number;
  build_config: Record<string, unknown>;
}

export interface BuildResult {
  apkPath: string;
  sizeBytes: number;
  sha256: string;
  log: string;
}

// Five phases, each 1.5–4s → total 8–20s. Much shorter than real
// Gradle but the seam (below) is in place.
const PHASES = ['Resolving', 'Compiling', 'Bundling', 'Signing', 'Verifying'] as const;
const PHASE_MIN_MS = 1500;
const PHASE_MAX_MS = 4000;

const APK_BUILD_MODE = (process.env.APK_BUILD_MODE ?? 'simulated').toLowerCase();
const APK_TEMPLATE_DIR =
  process.env.APK_TEMPLATE_DIR ?? path.resolve(__dirname, '../templates/android-app');

// Files we string-substitute placeholders in. Keep this list narrow so we
// don't mangle binary assets if any sneak into the template directory.
const TEMPLATED_EXTS = new Set([
  '.kts',
  '.kt',
  '.xml',
  '.java',
  '.gradle',
  '.properties',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitter(): number {
  return PHASE_MIN_MS + Math.floor(Math.random() * (PHASE_MAX_MS - PHASE_MIN_MS));
}

// ---------------------------------------------------------------------
// Run the build for one claimed job. Dispatches to the simulated or
// real Gradle path based on APK_BUILD_MODE. Returns the APK path, byte
// size, sha256 hex, and the captured build log.
// ---------------------------------------------------------------------
export async function buildApk(
  ctx: BuildContext,
  logger: pino.Logger,
): Promise<BuildResult> {
  if (APK_BUILD_MODE === 'gradle') {
    return runGradleBuild(ctx, logger);
  }
  return runSimulatedBuild(ctx, logger);
}

// ---------------------------------------------------------------------
// Simulated build — original behavior. Keep this unchanged so dev
// environments without Android SDK still produce a usable APK-shaped
// artifact end-to-end.
// ---------------------------------------------------------------------
async function runSimulatedBuild(
  ctx: BuildContext,
  logger: pino.Logger,
): Promise<BuildResult> {
  const startedAtIso = new Date().toISOString();
  const log = new LogBuffer();
  log.line('build_starting', {
    build_id: ctx.build_id,
    app_id: ctx.app_id,
    version_name: ctx.version_name,
    version_code: ctx.version_code,
    mode: 'simulated',
  });
  logger.info({
    build_id: ctx.build_id,
    app_id: ctx.app_id,
    version_name: ctx.version_name,
    version_code: ctx.version_code,
  }, 'build_starting');

  // Walk through the simulated phases so logs look real.
  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    const wait = jitter();
    log.line('build_phase_start', { phase, wait });
    logger.info({ build_id: ctx.build_id, phase, wait }, 'build_phase_start');
    await sleep(wait);
    log.line('build_phase_done', { phase });
    logger.info({ build_id: ctx.build_id, phase }, 'build_phase_done');
  }

  const apkPath = path.join('/tmp', `${ctx.build_id}.apk`);
  await fsp.mkdir(path.dirname(apkPath), { recursive: true });

  const manifest = [
    'Manifest-Version: 1.0',
    'Created-By: pushcare-apk-builder/simulated',
    `PushCare-Build-Id: ${ctx.build_id}`,
    `PushCare-App-Id: ${ctx.app_id}`,
    `PushCare-Version-Name: ${ctx.version_name}`,
    `PushCare-Version-Code: ${ctx.version_code}`,
    '',
  ].join('\n');

  const buildJson = JSON.stringify(
    {
      ...ctx,
      _simulated_build: true,
      _started_at: startedAtIso,
      _completed_at: new Date().toISOString(),
    },
    null,
    2,
  );

  const noticeText = [
    'PushCare simulated APK',
    '----------------------',
    'This artifact is produced by backends/apk-builder/ in simulated mode.',
    'It is a real ZIP file shaped like an APK, but no Android code was',
    'compiled. Set APK_BUILD_MODE=gradle (and provide an Android SDK +',
    'JDK 17 + gradle on PATH) to produce a real signed APK.',
    '',
  ].join('\n');

  // ---------------------------------------------------------------------
  // PRODUCTION: in gradle mode, runGradleBuild() below replaces this
  // archiver path entirely. The simulated path stays here so dev
  // environments without an Android SDK still drain the queue.
  // ---------------------------------------------------------------------
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(apkPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    out.on('close', () => resolve());
    out.on('error', (err) => reject(err));
    archive.on('error', (err) => reject(err));

    archive.pipe(out);
    archive.append(Readable.from([manifest]), { name: 'META-INF/MANIFEST.MF' });
    archive.append(Readable.from([buildJson]), { name: 'pushcare/build.json' });
    archive.append(Readable.from([noticeText]), { name: 'pushcare/template.txt' });
    archive.finalize().catch(reject);
  });

  // sha256 over the produced file.
  const sha256 = await sha256OfFile(apkPath);
  const stat = await fsp.stat(apkPath);

  log.line('build_artifact_ready', {
    apk_path: apkPath,
    size_bytes: stat.size,
    sha256,
  });
  logger.info({
    build_id: ctx.build_id,
    apk_path: apkPath,
    size_bytes: stat.size,
    sha256,
  }, 'build_artifact_ready');

  return { apkPath, sizeBytes: stat.size, sha256, log: log.toString() };
}

// ---------------------------------------------------------------------
// Real Gradle build path. Activated by APK_BUILD_MODE=gradle.
//
//   1. Copy templates/android-app/ → /tmp/pushcare-build-<id>/
//   2. Substitute __PUSHCARE_*__ placeholders from ctx.build_config.
//   3. chmod +x gradlew, run `bash gradlew assembleRelease`.
//   4. Pipe stdout+stderr line-by-line into the build log buffer.
//   5. Locate app-release.apk (or app-release-unsigned.apk), move to
//      /tmp/<build_id>.apk, compute sha256+size, return BuildResult.
//
// PRODUCTION:
//   * Swap the per-tenant signing keystore in here from
//     ctx.build_config.signing_keystore (currently we just rely on
//     workdir/keystores/release.jks if a tenant pre-staged one).
//   * For caching, retain the gradle dist + ~/.gradle between builds
//     with a Docker volume (otherwise every build re-downloads gradle
//     8.7 + the entire AndroidX classpath).
// ---------------------------------------------------------------------
export async function runGradleBuild(
  ctx: BuildContext,
  logger: pino.Logger,
): Promise<BuildResult> {
  const startedAtIso = new Date().toISOString();
  const log = new LogBuffer();
  const workDir = path.join('/tmp', `pushcare-build-${ctx.build_id}`);

  log.line('build_starting', {
    build_id: ctx.build_id,
    app_id: ctx.app_id,
    version_name: ctx.version_name,
    version_code: ctx.version_code,
    mode: 'gradle',
    template_dir: APK_TEMPLATE_DIR,
    work_dir: workDir,
    started_at: startedAtIso,
  });
  logger.info({
    build_id: ctx.build_id,
    template_dir: APK_TEMPLATE_DIR,
    work_dir: workDir,
  }, 'build_starting');

  // 1. Clean and recreate the work dir, then copy template tree.
  await fsp.rm(workDir, { recursive: true, force: true });
  await fsp.mkdir(workDir, { recursive: true });
  await copyDir(APK_TEMPLATE_DIR, workDir);
  log.line('template_copied');

  // 2. Templating pass — substitute placeholders in source files.
  const subs = buildSubstitutions(ctx);
  log.line('templating_start', { placeholders: Object.keys(subs) });
  await templateDir(workDir, subs);
  log.line('templating_done');

  // 2b. Relocate Kotlin/Java sources from io/pushcare/template/ to a
  //     directory tree matching the resolved package name. AGP requires
  //     the source directory to match the file's `package` declaration,
  //     and we already substituted that into the source files above.
  const resolvedPackage = subs['__PUSHCARE_PACKAGE_NAME__'];
  await relocateSources(workDir, 'io.pushcare.template', resolvedPackage);
  log.line('sources_relocated', { from: 'io.pushcare.template', to: resolvedPackage });

  // 3. Make gradlew executable (fsp.chmod is cross-platform; on Windows
  //    this is a no-op but the worker is normally a Linux pod).
  const gradlewPath = path.join(workDir, 'gradlew');
  try {
    await fsp.chmod(gradlewPath, 0o755);
  } catch (err) {
    log.line('chmod_warn', { err: String(err) });
  }

  // 4. Run gradle. Pipe both stdout and stderr line-by-line into log.
  const exitCode = await runChild('bash', ['gradlew', 'assembleRelease'], {
    cwd: workDir,
    onLine: (line) => {
      log.raw(line);
      logger.debug({ build_id: ctx.build_id, gradle: line }, 'gradle_line');
    },
  });

  if (exitCode !== 0) {
    const tail = log.tail(4096);
    log.line('build_failed', { exit_code: exitCode });
    throw new Error(
      `gradle assembleRelease exited with ${exitCode}. Tail of build log:\n${tail}`,
    );
  }

  // 5. Locate the produced APK. assembleRelease normally writes to
  //    app/build/outputs/apk/release/. The exact filename depends on
  //    whether a signing config was found.
  const apkCandidates = [
    path.join(workDir, 'app/build/outputs/apk/release/app-release.apk'),
    path.join(workDir, 'app/build/outputs/apk/release/app-release-unsigned.apk'),
  ];
  let producedApk: string | null = null;
  for (const candidate of apkCandidates) {
    if (await pathExists(candidate)) {
      producedApk = candidate;
      break;
    }
  }
  if (!producedApk) {
    log.line('apk_not_found', { tried: apkCandidates });
    throw new Error(
      `gradle assembleRelease succeeded but no APK was found. Searched: ${apkCandidates.join(', ')}`,
    );
  }

  const finalApkPath = path.join('/tmp', `${ctx.build_id}.apk`);
  await fsp.mkdir(path.dirname(finalApkPath), { recursive: true });
  await fsp.copyFile(producedApk, finalApkPath);

  const sha256 = await sha256OfFile(finalApkPath);
  const stat = await fsp.stat(finalApkPath);

  log.line('build_artifact_ready', {
    apk_path: finalApkPath,
    size_bytes: stat.size,
    sha256,
    source_apk: producedApk,
  });
  logger.info({
    build_id: ctx.build_id,
    apk_path: finalApkPath,
    size_bytes: stat.size,
    sha256,
  }, 'build_artifact_ready');

  return { apkPath: finalApkPath, sizeBytes: stat.size, sha256, log: log.toString() };
}

// ---------------------------------------------------------------------
// LogBuffer — single in-memory text buffer streamed into the worker's
// log column. We append timestamps so the admin UI can render the file
// directly without further parsing.
// ---------------------------------------------------------------------
class LogBuffer {
  private chunks: string[] = [];

  line(event: string, fields?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const tail = fields ? ` ${JSON.stringify(fields)}` : '';
    this.chunks.push(`[${ts}] ${event}${tail}\n`);
  }

  raw(line: string): void {
    const ts = new Date().toISOString();
    this.chunks.push(`[${ts}] ${line}\n`);
  }

  tail(maxBytes: number): string {
    const all = this.chunks.join('');
    if (all.length <= maxBytes) return all;
    return all.slice(all.length - maxBytes);
  }

  toString(): string {
    return this.chunks.join('');
  }
}

// ---------------------------------------------------------------------
// Build the placeholder → value map from the build context. Falls back
// to safe defaults so a build never blocks on a missing config field.
// ---------------------------------------------------------------------
function buildSubstitutions(ctx: BuildContext): Record<string, string> {
  const cfg = (ctx.build_config ?? {}) as Record<string, unknown>;
  const str = (k: string, fallback: string): string => {
    const v = cfg[k];
    return typeof v === 'string' && v.length > 0 ? v : fallback;
  };
  const fallbackKey = `pk_${'0'.repeat(48)}`;
  return {
    __PUSHCARE_APP_KEY__: str('app_key', fallbackKey),
    __PUSHCARE_PACKAGE_NAME__: str('package_name', `io.pushcare.app${ctx.app_id.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`),
    __PUSHCARE_APP_NAME__: str('app_name', 'PushCare App'),
    __PUSHCARE_VERSION_NAME__: ctx.version_name || '0.0.1',
    // Integer placeholder — stays unquoted in app/build.gradle.kts.
    __PUSHCARE_VERSION_CODE__: String(ctx.version_code || 1),
    __PUSHCARE_API_BASE__: str('api_base', 'https://api.pushcare.net'),
  };
}

// ---------------------------------------------------------------------
// Recursively copy a directory using fs/promises. We don't pull in
// fs-extra to keep the dependency set small.
// ---------------------------------------------------------------------
async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fsp.readdir(src, { withFileTypes: true });
  await fsp.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isSymbolicLink()) {
      const target = await fsp.readlink(s);
      await fsp.symlink(target, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

// ---------------------------------------------------------------------
// Walk the work dir and string-substitute placeholders in every text
// file we recognize. We skip binary files (anything outside
// TEMPLATED_EXTS). Cross-platform — we don't shell out for sed.
// ---------------------------------------------------------------------
async function templateDir(
  dir: string,
  substitutions: Record<string, string>,
): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await templateDir(full, substitutions);
      continue;
    }
    if (!entry.isFile()) continue;

    // Treat `*.gradle.kts` as `.kts`; path.extname returns only the last.
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEMPLATED_EXTS.has(ext)) continue;

    const original = await fsp.readFile(full, 'utf8');
    let replaced = original;
    for (const [needle, value] of Object.entries(substitutions)) {
      // Naive global string replace; placeholders are distinct enough
      // that we don't need regex escaping.
      replaced = replaced.split(needle).join(value);
    }
    if (replaced !== original) {
      await fsp.writeFile(full, replaced, 'utf8');
    }
  }
}

// ---------------------------------------------------------------------
// Spawn a child process and stream its combined stdout+stderr line by
// line into onLine. Resolves with the exit code (0 on success).
// ---------------------------------------------------------------------
async function runChild(
  cmd: string,
  args: readonly string[],
  opts: { cwd: string; onLine: (line: string) => void },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args as string[], {
      cwd: opts.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const drain = (stream: NodeJS.ReadableStream): void => {
      let buf = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        buf += chunk;
        let idx = buf.indexOf('\n');
        while (idx !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          opts.onLine(line);
          buf = buf.slice(idx + 1);
          idx = buf.indexOf('\n');
        }
      });
      stream.on('end', () => {
        if (buf.length > 0) opts.onLine(buf);
      });
    };

    if (child.stdout) drain(child.stdout);
    if (child.stderr) drain(child.stderr);

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve(code ?? 0));
  });
}

// ---------------------------------------------------------------------
// Compute sha256 of a file via streaming read.
// ---------------------------------------------------------------------
async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
  return hash.digest('hex');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Move Kotlin/Java sources from the template package directory tree to
// one matching the resolved Android package. AGP fails compilation when
// the on-disk path does not match the file's `package` declaration.
//
// Example: app/src/main/java/io/pushcare/template/MainActivity.kt
//      → app/src/main/java/com/acme/app/MainActivity.kt   (when package
//                                                          name = com.acme.app)
//
// Walks both `app/src/main/java/` and `app/src/main/kotlin/` if present.
// ---------------------------------------------------------------------
async function relocateSources(
  workDir: string,
  fromPackage: string,
  toPackage: string,
): Promise<void> {
  if (!toPackage || fromPackage === toPackage) return;
  const fromRel = fromPackage.replace(/\./g, path.sep);
  const toRel = toPackage.replace(/\./g, path.sep);
  for (const sourceRoot of ['app/src/main/java', 'app/src/main/kotlin']) {
    const fromDir = path.join(workDir, sourceRoot, fromRel);
    if (!(await pathExists(fromDir))) continue;
    const toDir = path.join(workDir, sourceRoot, toRel);
    await fsp.mkdir(path.dirname(toDir), { recursive: true });
    await fsp.rename(fromDir, toDir);
    // Best-effort: prune any now-empty intermediate directories.
    let prune = path.dirname(fromDir);
    const stopAt = path.join(workDir, sourceRoot);
    while (prune !== stopAt && prune.length > stopAt.length) {
      try {
        const entries = await fsp.readdir(prune);
        if (entries.length > 0) break;
        await fsp.rmdir(prune);
        prune = path.dirname(prune);
      } catch {
        break;
      }
    }
  }
}
