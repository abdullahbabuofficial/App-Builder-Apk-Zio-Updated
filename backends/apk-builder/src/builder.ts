// apk-builder/src/builder.ts
//
// Simulated APK build pipeline. This module exists to give us the
// worker shape — queue draining, status updates, an APK-shaped
// artifact — without yet wiring up Gradle or Android signing keys.
//
// The artifact produced is a real ZIP file (APKs are ZIPs) containing
// a manifest, a build descriptor, and a notice file. Downstream code
// computes its sha256 and reports size, just like a real build.

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
}

// Five phases, each 1.5–4s → total 8–20s. Much shorter than real
// Gradle but the seam (below) is in place.
const PHASES = ['Resolving', 'Compiling', 'Bundling', 'Signing', 'Verifying'] as const;
const PHASE_MIN_MS = 1500;
const PHASE_MAX_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitter(): number {
  return PHASE_MIN_MS + Math.floor(Math.random() * (PHASE_MAX_MS - PHASE_MIN_MS));
}

// ---------------------------------------------------------------------
// Run the (currently simulated) build for one claimed job. Returns the
// path to the produced APK, its byte size, and its sha256 hex.
// ---------------------------------------------------------------------
export async function buildApk(
  ctx: BuildContext,
  logger: pino.Logger,
): Promise<BuildResult> {
  const startedAtIso = new Date().toISOString();
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
    logger.info({ build_id: ctx.build_id, phase, wait }, 'build_phase_start');
    await sleep(wait);
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
    'compiled. Replace the SEAM block in src/builder.ts with a real',
    'Gradle invocation to produce a signed installable APK.',
    '',
  ].join('\n');

  // ---------------------------------------------------------------------
  // SEAM: replace this simulated build with a real Gradle invocation.
  //   1. Run `gradlew assembleRelease` in a checkout of the customer's
  //      Android project (or a templated project with their app_key
  //      injected into BuildConfig).
  //   2. Sign the APK with the v2 signing scheme using the platform key
  //      stored in fcm_credentials/keystore.
  //   3. Run zipalign.
  //   4. Return the apkPath; the rest of this module stays the same.
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
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(apkPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
  const sha256 = hash.digest('hex');
  const stat = await fsp.stat(apkPath);

  logger.info({
    build_id: ctx.build_id,
    apk_path: apkPath,
    size_bytes: stat.size,
    sha256,
  }, 'build_artifact_ready');

  return { apkPath, sizeBytes: stat.size, sha256 };
}
