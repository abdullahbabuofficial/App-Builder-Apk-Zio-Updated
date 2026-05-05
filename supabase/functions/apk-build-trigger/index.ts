// supabase/functions/apk-build-trigger/index.ts
//
// POST /apk-build-trigger
//
// Dashboard-authed endpoint that queues a row in apk_builds for the
// out-of-band APK builder worker to pick up. We pass the caller's JWT
// straight through to a fresh anon-client so RLS scopes the insert to
// rows the caller actually owns; an RLS violation is surfaced as 403
// app_not_found (we don't differentiate "not found" from "not yours" —
// both leak information about other tenants).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  errorResponse, jsonResponse, handleOptions, safeJson, v,
} from '../_shared/utils.ts';

interface TriggerBody {
  app_id: string;
  version_name: string;
  version_code: number;
  branch?: string;
  release_notes?: string;
  build_config?: Record<string, unknown>;
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const auth = req.headers.get('authorization');
  if (!auth) return errorResponse('unauthorized', 'Bearer token required', 401);

  // RLS-scoped client (mirrors apps-stats).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

  // ---- Body validation --------------------------------------------
  const body = await safeJson<TriggerBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');
  if (!v.uuid(body.app_id))
    return errorResponse('invalid_app_id', 'app_id must be a UUID');
  if (!v.str(1, 64)(body.version_name))
    return errorResponse('invalid_version_name', 'version_name 1..64 chars');
  if (typeof body.version_code !== 'number' || !Number.isInteger(body.version_code) || body.version_code < 1)
    return errorResponse('invalid_version_code', 'version_code must be a positive integer');
  if (body.branch !== undefined && !v.str(1, 200)(body.branch))
    return errorResponse('invalid_branch', 'branch 1..200 chars');
  if (body.release_notes !== undefined && !v.str(0, 8000)(body.release_notes))
    return errorResponse('invalid_release_notes', 'release_notes up to 8000 chars');
  if (body.build_config !== undefined && !v.obj(body.build_config))
    return errorResponse('invalid_build_config', 'build_config must be an object');

  // ---- Resolve owner_id via the JWT-bound client (RLS enforces) ---
  const { data: app, error: appErr } = await supabase
    .from('android_apps')
    .select('app_id, owner_id')
    .eq('app_id', body.app_id)
    .maybeSingle();

  if (appErr || !app) {
    // RLS will hide rows the caller doesn't own — same response either way.
    return errorResponse('app_not_found', 'app not found', 403);
  }

  // ---- Build merged config ----------------------------------------
  const mergedConfig: Record<string, unknown> = {
    ...(body.build_config ?? {}),
    branch: body.branch ?? null,
    release_notes: body.release_notes ?? null,
  };

  // ---- Insert apk_builds row --------------------------------------
  const { data: build, error: insErr } = await supabase
    .from('apk_builds')
    .insert({
      app_id: body.app_id,
      owner_id: app.owner_id,
      version_name: body.version_name,
      version_code: body.version_code,
      build_status: 'pending',
      build_config: mergedConfig,
      started_at: null,
      completed_at: null,
    })
    .select('build_id, build_status')
    .single();

  if (insErr || !build) {
    // RLS rejection looks like a permission error.
    const code = (insErr as unknown as { code?: string })?.code;
    if (code === '42501' || /row-level security/i.test(insErr?.message ?? '')) {
      return errorResponse('app_not_found', 'app not found', 403);
    }
    console.error('apk_build_insert_error', insErr);
    return errorResponse('queue_failed', 'could not queue build', 500);
  }

  // ---- Audit log --------------------------------------------------
  const { error: auditErr } = await supabase.rpc('emit_audit', {
    p_action: 'build.queued',
    p_target_type: 'apk_build',
    p_target_id: build.build_id,
    p_details: {
      app_id: body.app_id,
      version_name: body.version_name,
      version_code: body.version_code,
    },
  });
  if (auditErr) console.error('apk_build_audit_error', auditErr);

  return jsonResponse({
    ok: true,
    build_id: build.build_id,
    status: 'pending',
  }, 202);
});
