#!/usr/bin/env bash
# scripts/deploy-supabase.sh — Phase 1 staging rollout for Apkzio's Supabase tier.
#
# Wraps `backends/deployment.md` §1–3 (link, db push, edge function deploy) and
# pushes optional Edge Function secrets. The cron jobs from §2 are NOT scheduled
# here — run `make setup-cron` (or `psql -f scripts/setup-cron.sql`) after the
# first successful run.
#
# ─────────────────────────────────────────────────────────────────────────
# USAGE
#   SUPABASE_PROJECT_REF=abcdwxyz \
#   INVITE_APP_BASE_URL=https://admin.apkzio.com \
#   ./scripts/deploy-supabase.sh
#
# REQUIRED ENV
#   SUPABASE_PROJECT_REF   — Supabase project ref (xxxx in xxxx.supabase.co).
#
# OPTIONAL ENV (forwarded to `supabase secrets set` only when non-empty)
#   INVITE_APP_BASE_URL    — dashboard origin for team-invite join links.
#   INVITE_EMAIL_MODE      — "stub" (default) or "resend".
#   RESEND_API_KEY         — Resend API key (required if INVITE_EMAIL_MODE=resend).
#   INVITE_EMAIL_FROM      — Sender address (required if INVITE_EMAIL_MODE=resend).
#   WEBHOOK_SIGNING_SECRET — Fallback HMAC key for webhook-deliver.
#   DATABASE_URL           — direct Postgres URI; only used by the cron-SQL helper
#                            (`scripts/setup-cron.sql`), not by this script.
#   SUPABASE_ACCESS_TOKEN  — set to skip interactive `supabase login`.
#
# Per-step status is printed; the script exits non-zero on the first failure.
# Re-running is safe: link/db push/deploys are idempotent and `secrets set`
# overwrites in place. No cloud credentials are baked into git.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly CONFIG_TOML="${REPO_ROOT}/supabase/config.toml"
readonly FUNCTIONS_DIR="${REPO_ROOT}/supabase/functions"

# Hardcoded fallback list mirroring the deploy table in
# `backends/deployment.md` §3. Used only if dynamic discovery fails.
readonly FALLBACK_FUNCTIONS=(
  sdk-init sdk-register-device sdk-heartbeat sdk-event
  push-track push-send signup-init webhook-deliver
  apps-stats apk-build-trigger team-invite
)
# Functions that REQUIRE JWT (verify_jwt = true). Used for both fallback
# discovery and as a safety net if config.toml parsing yields no flag.
readonly JWT_REQUIRED_FALLBACK=(apps-stats apk-build-trigger team-invite)

die() { echo "error: $*" >&2; exit 1; }
note() { echo "→ $*"; }
section() { echo; echo "══ $* ══"; }

# ----- precondition checks -----
[[ -n "${SUPABASE_PROJECT_REF:-}" ]] \
  || die "SUPABASE_PROJECT_REF is required (run with --help-style env? see top of file)"
command -v supabase >/dev/null 2>&1 \
  || die "supabase CLI not found in PATH — install: https://supabase.com/docs/guides/cli"

cd "${REPO_ROOT}"

# ----- step 1: link -----
section "[1/4] supabase link --project-ref ${SUPABASE_PROJECT_REF}"
supabase link --project-ref "${SUPABASE_PROJECT_REF}"

# ----- step 2: db push -----
section "[2/4] supabase db push"
supabase db push

# ----- step 3: discover + deploy edge functions -----
section "[3/4] supabase functions deploy"

# Discover functions dynamically: every direct child of supabase/functions/
# that is a directory and is not `_shared` (or another underscore-prefixed
# helper). Falls back to the hardcoded list if the directory is missing or
# empty (e.g. running from an unusual checkout).
discover_functions() {
  local out=()
  if [[ -d "${FUNCTIONS_DIR}" ]]; then
    while IFS= read -r -d '' dir; do
      local name
      name="$(basename "${dir}")"
      [[ "${name}" == _* ]] && continue
      out+=("${name}")
    done < <(find "${FUNCTIONS_DIR}" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
  fi
  if [[ ${#out[@]} -eq 0 ]]; then
    note "warn: no functions discovered, using fallback list"
    out=("${FALLBACK_FUNCTIONS[@]}")
  fi
  printf '%s\n' "${out[@]}"
}

# Parse config.toml for `verify_jwt` flags. Returns "true" or "false" for a
# given function name; returns "unknown" when no explicit setting found, in
# which case we err on the side of safety.
parse_verify_jwt() {
  local fn="$1" config="${CONFIG_TOML}"
  if [[ ! -f "${config}" ]]; then
    echo unknown; return 0
  fi
  awk -v target="[functions.${fn}]" '
    BEGIN { in_block = 0; printed = 0 }
    /^\[/ {
      if ($0 == target) { in_block = 1 } else { in_block = 0 }
      next
    }
    in_block && /^[[:space:]]*verify_jwt[[:space:]]*=/ {
      gsub(/[[:space:]]/, "")
      sub(/^verify_jwt=/, "")
      sub(/#.*$/, "")
      print
      printed = 1
      exit
    }
    END { if (!printed) print "unknown" }
  ' "${config}"
}

# Treat parse failure as JWT-required for our known list, otherwise no-jwt
# (since the SDK is the dominant caller pattern).
in_jwt_required_fallback() {
  local fn="$1"
  for required in "${JWT_REQUIRED_FALLBACK[@]}"; do
    [[ "${required}" == "${fn}" ]] && return 0
  done
  return 1
}

mapfile -t FUNCTIONS < <(discover_functions)
note "discovered ${#FUNCTIONS[@]} function(s): ${FUNCTIONS[*]}"

deploy_failures=()
for fn in "${FUNCTIONS[@]}"; do
  flag="$(parse_verify_jwt "${fn}")"
  case "${flag}" in
    true)
      note "deploy ${fn}  [verify_jwt=true]"
      args=()
      ;;
    false)
      note "deploy ${fn}  [verify_jwt=false → --no-verify-jwt]"
      args=(--no-verify-jwt)
      ;;
    *)
      if in_jwt_required_fallback "${fn}"; then
        note "deploy ${fn}  [config parse miss → fallback verify_jwt=true]"
        args=()
      else
        note "deploy ${fn}  [config parse miss → fallback --no-verify-jwt]"
        args=(--no-verify-jwt)
      fi
      ;;
  esac
  if ! supabase functions deploy "${fn}" "${args[@]}"; then
    deploy_failures+=("${fn}")
  fi
done

if [[ ${#deploy_failures[@]} -gt 0 ]]; then
  die "edge function deploy failed: ${deploy_failures[*]}"
fi

# ----- step 4: edge secrets -----
section "[4/4] supabase secrets set (only non-empty inputs)"

set_secret() {
  local key="$1" value="${2-}"
  if [[ -z "${value}" ]]; then
    note "skip ${key} (unset)"
    return 0
  fi
  note "set ${key}"
  supabase secrets set "${key}=${value}"
}

# Order matters only for log readability — all runs are independent.
set_secret INVITE_APP_BASE_URL    "${INVITE_APP_BASE_URL:-}"
set_secret INVITE_EMAIL_MODE      "${INVITE_EMAIL_MODE:-stub}"
set_secret RESEND_API_KEY         "${RESEND_API_KEY:-}"
set_secret INVITE_EMAIL_FROM      "${INVITE_EMAIL_FROM:-}"
set_secret WEBHOOK_SIGNING_SECRET "${WEBHOOK_SIGNING_SECRET:-}"

echo
echo "Done. Next:"
echo "  • Schedule cron jobs: make setup-cron   (requires DATABASE_URL)"
echo "  • Smoke test: see backends/deployment.md §6"
