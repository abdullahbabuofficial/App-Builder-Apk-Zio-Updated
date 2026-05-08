-- =====================================================================
-- ApkZio :: 002_seed_supabase.sql
-- One-shot seed for Supabase: creates two Auth users + app_owners rows.
-- Safe to re-run (uses ON CONFLICT).
--
-- Credentials:
--   Admin: test@admin.com / Test@123  (plan=enterprise, email confirmed)
--   User : test@user.com  / Test@123  (plan=free, email confirmed)
--
-- Prereqs:
--   * Run after 001_core_schema.sql (uuid-ossp, pgcrypto are already enabled there).
--   * Execute with a service role (or locally via psql with sufficient privileges)
--     so inserts into auth.* are allowed.
-- =====================================================================

WITH upsert_auth AS (
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  VALUES
    (
      uuid_generate_v4(),
      'test@admin.com',
      crypt('Test@123', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      '{}'::jsonb,
      'authenticated',
      'authenticated'
    ),
    (
      uuid_generate_v4(),
      'test@user.com',
      crypt('Test@123', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      '{}'::jsonb,
      'authenticated',
      'authenticated'
    )
  ON CONFLICT (email) DO UPDATE
    SET encrypted_password   = EXCLUDED.encrypted_password,
        email_confirmed_at   = EXCLUDED.email_confirmed_at,
        confirmation_sent_at = EXCLUDED.confirmation_sent_at,
        last_sign_in_at      = EXCLUDED.last_sign_in_at
  RETURNING id, email
),
ids AS (
  SELECT id, email FROM upsert_auth
),
ensure_identities AS (
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    uuid_generate_v4(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.email,
    now(),
    now(),
    now()
  FROM ids u
  ON CONFLICT DO NOTHING
)
INSERT INTO app_owners (owner_id, auth_user_id, email, display_name, plan)
SELECT
  uuid_generate_v4(),
  a.id,
  a.email,
  CASE WHEN a.email = 'test@admin.com' THEN 'Test Admin' ELSE 'Test User' END,
  CASE WHEN a.email = 'test@admin.com' THEN 'enterprise' ELSE 'free' END
FROM ids a
ON CONFLICT (email) DO UPDATE
  SET auth_user_id = EXCLUDED.auth_user_id,
      plan = EXCLUDED.plan;

