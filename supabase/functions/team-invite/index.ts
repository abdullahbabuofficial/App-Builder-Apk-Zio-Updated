// supabase/functions/team-invite/index.ts
//
// POST /team-invite
//
// Dashboard-authed endpoint that creates an org_invites row for a
// teammate to claim. RLS does the heavy lifting: WITH CHECK on the
// table forces owner_id = current_owner_id() (derived from the JWT).
//
// We return the raw token in the response so the dashboard can render
// a "copy link" button. Email delivery is intentionally skipped for
// now — see TODO at the bottom.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  errorResponse, jsonResponse, handleOptions, safeJson, v,
} from '../_shared/utils.ts';

interface InviteBody {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INVITABLE_ROLES = new Set(['admin', 'developer', 'viewer']);

function randomTokenHex(byteLen = 16): string {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const body = await safeJson<InviteBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');

  if (typeof body.email !== 'string')
    return errorResponse('invalid_email', 'email is required');
  const email = body.email.trim().toLowerCase();
  if (!v.str(5, 200)(email) || !EMAIL_RE.test(email))
    return errorResponse('invalid_email', 'email must be a valid address (5..200 chars)');

  if (typeof body.role !== 'string')
    return errorResponse('invalid_role', 'role is required');
  if (body.role === 'owner' || body.role === 'service')
    return errorResponse('invalid_role', `${body.role} role is not invitable`);
  if (!INVITABLE_ROLES.has(body.role))
    return errorResponse('invalid_role', `role must be one of: ${[...INVITABLE_ROLES].join(',')}`);

  // ---- Resolve owner_id from the caller's JWT ---------------------
  // `org_invites.owner_id` is NOT NULL, and the column has no default
  // (RLS WITH CHECK runs after the NOT NULL check). Resolve it explicitly
  // via the same auth.uid() → app_owners.owner_id mapping that
  // current_owner_id() uses on the SQL side.
  const { data: authUser } = await supabase.auth.getUser();
  const userId = authUser.user?.id ?? null;
  if (!userId) return errorResponse('unauthorized', 'JWT did not resolve to a user', 401);

  const { data: ownerRow, error: ownerErr } = await supabase
    .from('app_owners')
    .select('owner_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (ownerErr) {
    console.error('team_invite_owner_lookup_error', ownerErr);
    return errorResponse('owner_lookup_failed', 'could not resolve workspace', 500);
  }
  if (!ownerRow) return errorResponse('no_workspace', 'no app_owners row for this user', 403);

  // ---- Insert invite (RLS WITH CHECK still verifies owner match) --
  const token = randomTokenHex(16);
  const { data: invite, error: insErr } = await supabase
    .from('org_invites')
    .insert({
      owner_id: ownerRow.owner_id,
      email,
      role: body.role,
      invited_by: userId,
      token,
    })
    .select('invite_id, email, role, token, expires_at')
    .single();

  if (insErr || !invite) {
    const code = (insErr as unknown as { code?: string })?.code;
    if (code === '42501' || /row-level security/i.test(insErr?.message ?? '')) {
      return errorResponse('forbidden', 'not allowed to invite here', 403);
    }
    if (code === '23505') {
      return errorResponse('invite_exists', 'an invite for that email already exists', 409);
    }
    console.error('team_invite_insert_error', insErr);
    return errorResponse('invite_failed', 'could not create invite', 500);
  }

  // ---- Audit log --------------------------------------------------
  const { error: auditErr } = await supabase.rpc('emit_audit', {
    p_action: 'member.invited',
    p_target_type: 'org_invite',
    p_target_id: invite.invite_id,
    p_details: { email: invite.email, role: invite.role },
  });
  if (auditErr) console.error('team_invite_audit_error', auditErr);

  // TODO: send invite email with the token (e.g. via Postmark/Resend).
  // For now the dashboard surfaces a copy-able link to the user.

  return jsonResponse({
    ok: true,
    invite: {
      id: invite.invite_id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expires_at: invite.expires_at,
    },
  }, 201);
});
