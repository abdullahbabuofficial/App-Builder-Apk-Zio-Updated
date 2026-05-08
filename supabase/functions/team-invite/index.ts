// supabase/functions/team-invite/index.ts
//
// POST /team-invite
//
// Dashboard-authed endpoint that creates an org_invites row for a teammate to claim.
//
// Invite email behaviour is controlled by `INVITE_EMAIL_MODE`:
//   - `stub` (default): no outbound email. Response JSON includes `invite_url`
//     so ops / the dashboard can copy a join link during development.
//   - `resend`: sends HTML email via Resend REST API (`RESEND_API_KEY`,
//     `INVITE_EMAIL_FROM`; optional `INVITE_EMAIL_SUBJECT`).
//
// Responses intentionally omit a bare `invite.token` field to reduce accidental
// token leakage via logs — the opaque value appears only inside `invite_url`
// (stub / error recovery in resend) or only in outbound email HTML (successful
// resend). Tune `INVITE_APP_BASE_URL` so join links hit the SPA route where
// the invite UX will live (e.g. `https://admin.example.com` → links to `/invite`).
//
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
const INVITE_REL_PATH = '/invite';

function randomTokenHex(byteLen = 16): string {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Human-facing join URL; INVITE_APP_BASE_URL should be dashboard origin without trailing slash. */
function buildInviteUrl(token: string): string {
  const base = (Deno.env.get('INVITE_APP_BASE_URL') ?? '').replace(/\/+$/, '');
  const q = new URLSearchParams({ token }).toString();
  if (!base) return `${INVITE_REL_PATH}?${q}`;
  return `${base}${INVITE_REL_PATH}?${q}`;
}

async function sendResendInviteEmail(
  to: string,
  inviteUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('INVITE_EMAIL_FROM')?.trim();
  if (!key) return { ok: false, error: 'missing_config: RESEND_API_KEY' };
  if (!from) return { ok: false, error: 'missing_config: INVITE_EMAIL_FROM' };

  const subject =
    Deno.env.get('INVITE_EMAIL_SUBJECT')?.trim() ||
    'You have been invited to join a workspace';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `
        <p>You have been invited to join an ApkZio workspace.</p>
        <p><a href="${inviteUrl}">Accept invitation</a></p>
        <p>If the button does not work, paste this URL into your browser:<br>${inviteUrl}</p>
      `,
    }),
  });

  if (!res.ok) {
    const text = truncate(await res.text(), 2048);
    return { ok: false, error: `resend_http_${res.status}: ${text}` };
  }
  return { ok: true };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const auth = req.headers.get('authorization');
  if (!auth) return errorResponse('unauthorized', 'Bearer token required', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

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
    .select('invite_id, email, role, expires_at')
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

  const { error: auditErr } = await supabase.rpc('emit_audit', {
    p_action: 'member.invited',
    p_target_type: 'org_invite',
    p_target_id: invite.invite_id,
    p_details: { email: invite.email, role: invite.role },
  });
  if (auditErr) console.error('team_invite_audit_error', auditErr);

  const inviteBase = buildInviteUrl(token);

  const mode = (Deno.env.get('INVITE_EMAIL_MODE') ?? 'stub').trim().toLowerCase();

  const inviteSansToken = {
    id: invite.invite_id,
    email: invite.email,
    role: invite.role,
    expires_at: invite.expires_at,
  };

  if (mode === 'resend') {
    const mailed = await sendResendInviteEmail(invite.email, inviteBase);
    if (mailed.ok === false) {
      console.error('team_invite_resend_error', mailed.error);
      return jsonResponse(
        {
          ok: true,
          invite: inviteSansToken,
          email_sent: false,
          invite_url: inviteBase,
          email_error: mailed.error,
        },
        201,
      );
    }
    return jsonResponse(
      { ok: true, invite: inviteSansToken, email_sent: true },
      201,
    );
  }

  // stub (default): no SMTP; frontend / operator copies invite_url only.
  if (mode !== 'stub') {
    console.warn('team_invite_unknown_mode', mode, '(using stub)');
  }
  return jsonResponse({
    ok: true,
    invite: inviteSansToken,
    invite_url: inviteBase,
  }, 201);
});
