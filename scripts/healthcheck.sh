#!/usr/bin/env bash
# scripts/healthcheck.sh — verify the dispatcher's /healthz endpoint (GET /health is equivalent).
#
# Curls ${DISPATCHER_URL}/healthz and exits non-zero unless the JSON body
# contains "ok":true (matches the contract in firebase-service/src/index.ts).
#
# USAGE
#   DISPATCHER_URL=https://apkzio-dispatcher-xyz.a.run.app ./scripts/healthcheck.sh
#
# REQUIRED ENV
#   DISPATCHER_URL — base URL of the deployed dispatcher (no trailing slash).
#
# OPTIONAL ENV
#   AUTH_TOKEN     — Bearer token to include (Cloud Run private services
#                    require an `Authorization: Bearer $(gcloud auth print-identity-token)`).
#   TIMEOUT        — curl --max-time, defaults to 10.
#
# Exit codes
#   0  endpoint returned ok:true
#   1  HTTP failure / non-2xx response
#   2  reachable but body did not assert ok:true
#   3  required env missing

set -euo pipefail

if [[ -z "${DISPATCHER_URL:-}" ]]; then
  echo "error: DISPATCHER_URL is required (e.g. https://<svc>.run.app)" >&2
  exit 3
fi

URL="${DISPATCHER_URL%/}/healthz"
TIMEOUT="${TIMEOUT:-10}"

curl_args=(--silent --show-error --fail --max-time "${TIMEOUT}")
if [[ -n "${AUTH_TOKEN:-}" ]]; then
  curl_args+=(-H "Authorization: Bearer ${AUTH_TOKEN}")
fi

echo "→ GET ${URL}"
if ! body="$(curl "${curl_args[@]}" "${URL}")"; then
  echo "error: request to ${URL} failed (network or non-2xx)" >&2
  exit 1
fi

echo "  body: ${body}"

# Parse "ok":true tolerantly: jq when available, otherwise a regex fallback
# that ignores whitespace between key/value.
if command -v jq >/dev/null 2>&1; then
  ok="$(printf '%s' "${body}" | jq -r '.ok // false' 2>/dev/null || echo false)"
else
  if [[ "${body}" =~ \"ok\"[[:space:]]*:[[:space:]]*true ]]; then
    ok=true
  else
    ok=false
  fi
fi

if [[ "${ok}" != "true" ]]; then
  echo "error: dispatcher reported ok != true" >&2
  exit 2
fi

echo "OK"
