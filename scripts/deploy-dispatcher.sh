#!/usr/bin/env bash
# scripts/deploy-dispatcher.sh — Phase 2 build + Cloud Run rollout for the
# firebase-service dispatcher.
#
# Wraps `backends/deployment.md` §5 (Cloud Run example): docker build,
# optional push, and `gcloud run deploy` with the exact knobs documented
# there (concurrency=1, cpu=2, mem=1Gi, min=2, max=20, env WORKER_CONCURRENCY/
# POLL_INTERVAL_MS/LOG_LEVEL).
#
# ─────────────────────────────────────────────────────────────────────────
# USAGE
#   GCP_PROJECT=apkzio-prod \
#   GCP_REGION=asia-southeast1 \
#   IMAGE_TAG=$(git rev-parse --short HEAD) \
#   DATABASE_URL_SECRET=apkzio-db-url \
#   FCM_SECRET=apkzio-fcm \
#   PUSH=true \
#   ./scripts/deploy-dispatcher.sh
#
# REQUIRED ENV
#   GCP_PROJECT          — GCP project id (used for the gcr.io repo path).
#   GCP_REGION           — Cloud Run region (e.g. asia-southeast1).
#   DATABASE_URL_SECRET  — Secret Manager name for DATABASE_URL (e.g. apkzio-db-url).
#   FCM_SECRET           — Secret Manager name for DEFAULT_FCM_CREDENTIALS (e.g. apkzio-fcm).
#
# OPTIONAL ENV
#   IMAGE_TAG            — defaults to "latest" (use a SHA in CI for traceability).
#   PUSH                 — "true" to docker push after build (default: false).
#   SERVICE_NAME         — Cloud Run service, defaults to "apkzio-dispatcher".
#   WORKER_CONCURRENCY   — internal async slots per pod, defaults to "4".
#   POLL_INTERVAL_MS     — claim poll interval in ms, defaults to "2000".
#   LOG_LEVEL            — pino log level, defaults to "info".
#   MIN_INSTANCES        — defaults to "2".
#   MAX_INSTANCES        — defaults to "20".
#
# Errors early if any required env is missing. Cloud auth is the operator's
# job (`gcloud auth login` / Workload Identity in CI) — this script does
# not invent auth flows or hardcode any secrets.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly DISPATCHER_DIR="${REPO_ROOT}/backends/firebase-service"

die()     { echo "error: $*" >&2; exit 1; }
note()    { echo "→ $*"; }
section() { echo; echo "══ $* ══"; }

# ----- precondition checks -----
: "${GCP_PROJECT:?GCP_PROJECT is required}"
: "${GCP_REGION:?GCP_REGION is required}"
: "${DATABASE_URL_SECRET:?DATABASE_URL_SECRET is required}"
: "${FCM_SECRET:?FCM_SECRET is required}"

IMAGE_TAG="${IMAGE_TAG:-latest}"
PUSH="${PUSH:-false}"
SERVICE_NAME="${SERVICE_NAME:-apkzio-dispatcher}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-4}"
POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-2000}"
LOG_LEVEL="${LOG_LEVEL:-info}"
MIN_INSTANCES="${MIN_INSTANCES:-2}"
MAX_INSTANCES="${MAX_INSTANCES:-20}"

IMAGE="gcr.io/${GCP_PROJECT}/${SERVICE_NAME}:${IMAGE_TAG}"

command -v docker >/dev/null 2>&1 \
  || die "docker not found in PATH"
[[ -d "${DISPATCHER_DIR}" ]] \
  || die "expected ${DISPATCHER_DIR} (firebase-service source) to exist"

# ----- step 1: build -----
section "[1/3] docker build → ${IMAGE}"
docker build -t "${IMAGE}" "${DISPATCHER_DIR}"

# ----- step 2: push (only if PUSH=true) -----
if [[ "${PUSH}" == "true" ]]; then
  section "[2/3] docker push → ${IMAGE}"
  docker push "${IMAGE}"
else
  section "[2/3] docker push skipped (set PUSH=true to enable)"
fi

# ----- step 3: cloud run deploy -----
section "[3/3] gcloud run deploy ${SERVICE_NAME} (region=${GCP_REGION})"
command -v gcloud >/dev/null 2>&1 \
  || die "gcloud not found in PATH"

gcloud run deploy "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --region="${GCP_REGION}" \
  --image="${IMAGE}" \
  --concurrency=1 \
  --cpu=2 \
  --memory=1Gi \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --port=8080 \
  --no-allow-unauthenticated \
  --set-secrets="DATABASE_URL=${DATABASE_URL_SECRET}:latest,DEFAULT_FCM_CREDENTIALS=${FCM_SECRET}:latest" \
  --set-env-vars="WORKER_CONCURRENCY=${WORKER_CONCURRENCY},POLL_INTERVAL_MS=${POLL_INTERVAL_MS},LOG_LEVEL=${LOG_LEVEL}"

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)' || true)

echo
echo "Done."
if [[ -n "${URL:-}" ]]; then
  echo "Service URL: ${URL}"
  echo "Health check (authenticated invoker required):"
  echo "  DISPATCHER_URL=${URL} ./scripts/healthcheck.sh"
fi
