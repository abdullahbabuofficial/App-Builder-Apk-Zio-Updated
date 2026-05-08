#!/usr/bin/env bash
# Print copy-paste env lines for one Supabase project (no secrets invented).
#
# Usage:
#   SUPABASE_PROJECT_REF=abcd1234 ./scripts/supabase-env-hints.sh
#   ./scripts/supabase-env-hints.sh abcd1234
#
# Fill DATABASE_URL password from: Dashboard → Project Settings → Database → URI (Direct).

set -euo pipefail

REF="${1:-${SUPABASE_PROJECT_REF:-}}"
if [[ -z "${REF}" || "${REF}" == "YOUR_PROJECT_REF" ]]; then
  echo "error: set SUPABASE_PROJECT_REF or pass project ref as first argument" >&2
  exit 1
fi

BASE_URL="https://${REF}.supabase.co"

cat <<EOF
# --- backends/.env (and firebase-service/.env) ---
SUPABASE_PROJECT_REF=${REF}
SUPABASE_URL=${BASE_URL}
# Direct Postgres (dispatcher / psql / cron). Replace <PASSWORD>:
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.${REF}.supabase.co:5432/postgres?sslmode=require

# Keys from Dashboard → Project Settings → API (never commit real values)
# SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=

# --- apkzio-admin/.env.local  OR  apkzio-pub/.env.local ---
VITE_SUPABASE_URL=${BASE_URL}
VITE_SUPABASE_ANON_KEY=<paste_anon_public_key_here>

# Pub still needs your REST API for auth/builds unless you move those to Edge only:
# VITE_APKZIO_API_URL=http://127.0.0.1:8787

# --- Cursor MCP (.cursor/mcp.json) ---
# Set project_ref=${REF} in the Supabase MCP URL (see repo .cursor/mcp.json template).
EOF
