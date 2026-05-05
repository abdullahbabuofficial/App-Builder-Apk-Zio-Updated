// apk-builder/src/storage.ts
//
// Three-tier uploader.
//
// 1. Supabase Storage (bucket `apk-builds`) when SUPABASE_URL +
//    SUPABASE_SERVICE_ROLE_KEY are set. Production path.
// 2. Local OUTPUT_DIR copy when set. Useful for dev / CI.
// 3. Bare /tmp file otherwise — the file produced by builder.ts is
//    already there, so we just return its file:// URL.

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BuildContext } from './builder.js';
import { logger } from './logger.js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '';
const BUCKET = 'apk-builds';

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

// ---------------------------------------------------------------------
// Make sure the apk-builds bucket exists. Idempotent.
// ---------------------------------------------------------------------
async function ensureBucket(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.storage.getBucket(BUCKET);
  if (data) return;
  if (error && error.message.toLowerCase().includes('not found')) {
    const { error: createErr } = await client.storage.createBucket(BUCKET, {
      public: true,
    });
    if (createErr) throw new Error(`bucket_create_failed: ${createErr.message}`);
    logger.info({ bucket: BUCKET }, 'storage_bucket_created');
    return;
  }
  if (error) throw new Error(`bucket_get_failed: ${error.message}`);
}

// ---------------------------------------------------------------------
// Upload the produced APK and return a public URL.
// ---------------------------------------------------------------------
export async function uploadApk(ctx: BuildContext, apkPath: string): Promise<string> {
  const client = getSupabase();
  if (client) {
    await ensureBucket(client);
    const objectPath = `${ctx.app_id}/${ctx.version_code}/${ctx.build_id}.apk`;
    const file = await fsp.readFile(apkPath);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(objectPath, file, {
        contentType: 'application/vnd.android.package-archive',
        upsert: true,
      });
    if (error) throw new Error(`storage_upload_failed: ${error.message}`);
    const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
    logger.info({
      build_id: ctx.build_id,
      object_path: objectPath,
      public_url: data.publicUrl,
    }, 'storage_uploaded');
    return data.publicUrl;
  }

  if (OUTPUT_DIR) {
    await fsp.mkdir(OUTPUT_DIR, { recursive: true });
    const dest = path.join(OUTPUT_DIR, `${ctx.build_id}.apk`);
    await fsp.copyFile(apkPath, dest);
    const url = `file://${dest}`;
    logger.info({ build_id: ctx.build_id, dest, url }, 'storage_local_copied');
    return url;
  }

  // No storage configured — leave the file at /tmp.
  const url = `file://${apkPath}`;
  logger.info({ build_id: ctx.build_id, url }, 'storage_tmp_only');
  return url;
}
