// supabase/functions/signup-init/index.ts
//
// POST /signup-init
//
// Public sign-up endpoint for the dashboard. No JWT required — this is
// the front door for new tenants. We do the following in order, with
// best-effort rollback if anything past auth-user-creation fails:
//
//   1. IP-keyed rate limit (5 sign-ups / hour).
//   2. Validate email + password strength.
//   3. Create the Supabase Auth user (admin API, email_confirm=true).
//   4. Insert app_owners (FK to auth.users.id) — returns owner_id.
//   5. Look up the 'free' subscription_plans row, insert a trialing
//      org_subscriptions with current_period_end = NOW() + 14 days.
//   6. Optionally create the user's first android_apps row.
//
// On any DB error after step 3, we delete the auth user to avoid
// orphaned auth identities.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, safeJson, v,
} from '../_shared/utils.ts';

interface SignupBody {
  email: string;
  password: string;
  display_name?: string;
  starter_app?: { package_name: string; app_name: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  // ---- Rate limit (5 / hour / IP) ---------------------------------
  const supabase = getServiceClient();
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const ok = await checkRateLimit(supabase, `signup:${ip}`, 5, 3600);
  if (!ok) return errorResponse('rate_limited', 'too many sign-ups from this IP', 429);

  // ---- Body validation --------------------------------------------
  const raw = await safeJson<SignupBody>(req);
  if (!raw) return errorResponse('invalid_json', 'request body must be JSON');

  if (typeof raw.email !== 'string')
    return errorResponse('invalid_email', 'email is required');
  const email = raw.email.trim().toLowerCase();
  if (!v.str(5, 200)(email) || !EMAIL_RE.test(email))
    return errorResponse('invalid_email', 'email must be a valid address (5..200 chars)');

  if (!v.str(8, 72)(raw.password))
    return errorResponse('invalid_password', 'password must be 8..72 chars');

  if (raw.display_name !== undefined && !v.str(1, 200)(raw.display_name))
    return errorResponse('invalid_display_name', 'display_name 1..200 chars');

  let starter: { package_name: string; app_name: string } | undefined;
  if (raw.starter_app !== undefined) {
    if (!v.obj(raw.starter_app))
      return errorResponse('invalid_starter_app', 'starter_app must be an object');
    const sa = raw.starter_app as Record<string, unknown>;
    if (!v.str(1, 200)(sa.package_name))
      return errorResponse('invalid_starter_package_name', 'starter_app.package_name 1..200 chars');
    if (!v.str(1, 200)(sa.app_name))
      return errorResponse('invalid_starter_app_name', 'starter_app.app_name 1..200 chars');
    starter = { package_name: sa.package_name as string, app_name: sa.app_name as string };
  }

  // ---- Create Auth user -------------------------------------------
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: raw.password,
    email_confirm: true,
    user_metadata: raw.display_name ? { display_name: raw.display_name } : {},
  });

  if (authErr || !created?.user) {
    const msg = (authErr?.message ?? '').toLowerCase();
    const status = (authErr as unknown as { status?: number })?.status;
    if (status === 422 || msg.includes('already') || msg.includes('duplicate') || msg.includes('registered')) {
      return errorResponse('email_taken', 'email is already registered', 409);
    }
    console.error('signup_auth_error', authErr);
    return errorResponse('signup_failed', 'could not create user', 500);
  }
  const userId = created.user.id;

  // Helper to roll back on any DB failure past this point.
  const rollback = async (where: string, err: unknown) => {
    console.error(`signup_${where}_error`, err);
    try { await supabase.auth.admin.deleteUser(userId); } catch (e) {
      console.error('signup_rollback_failed', e);
    }
  };

  // ---- Insert app_owners ------------------------------------------
  const { data: owner, error: ownerErr } = await supabase
    .from('app_owners')
    .insert({
      auth_user_id: userId,
      email,
      display_name: raw.display_name ?? null,
    })
    .select('owner_id, email, display_name')
    .single();

  if (ownerErr || !owner) {
    await rollback('owner', ownerErr);
    return errorResponse('signup_failed', 'could not create owner', 500);
  }

  // ---- Free plan + trialing subscription --------------------------
  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans')
    .select('plan_id')
    .eq('code', 'free')
    .maybeSingle();

  if (planErr) {
    await rollback('plan_lookup', planErr);
    return errorResponse('signup_failed', 'could not load plan', 500);
  }

  if (plan?.plan_id) {
    const periodEnd = new Date(Date.now() + 14 * 86400_000).toISOString();
    const { error: subErr } = await supabase
      .from('org_subscriptions')
      .insert({
        owner_id: owner.owner_id,
        plan_id: plan.plan_id,
        status: 'trialing',
        current_period_end: periodEnd,
      });
    if (subErr) {
      await rollback('subscription', subErr);
      return errorResponse('signup_failed', 'could not provision subscription', 500);
    }
  }

  // ---- Optional starter app --------------------------------------
  let app: { app_id: string; app_key: string; package_name: string; app_name: string } | null = null;
  if (starter) {
    const { data: appRow, error: appErr } = await supabase
      .from('android_apps')
      .insert({
        owner_id: owner.owner_id,
        package_name: starter.package_name,
        app_name: starter.app_name,
        status: 'active',
      })
      .select('app_id, app_key, package_name, app_name')
      .single();
    if (appErr || !appRow) {
      await rollback('starter_app', appErr);
      return errorResponse('signup_failed', 'could not create starter app', 500);
    }
    app = appRow;
  }

  return jsonResponse({
    ok: true,
    owner_id: owner.owner_id,
    email: owner.email,
    app,
  }, 201);
});
