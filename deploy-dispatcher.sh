#!/usr/bin/env bash
# deploy-dispatcher.sh — build + push + roll out the ApkZio FCM dispatcher.
#
# Wraps the steps from `backends/deployment.md` §5:
#   1. cd backends/firebase-service
#   2. docker build
#   3. docker push  (or gcloud builds submit, depending on registry)
#   4. gcloud run deploy
#
# Required env:
#   GCP_PROJECT          — GCP project id, used for the gcr.io repo path.
#   FCM_SECRET_NAME      — name of Secret Manager secret holding service account
#                          JSON for DEFAULT_FCM_CREDENTIALS (e.g. apkzio-fcm).
#   DB_SECRET_NAME       — name of Secret Manager secret holding DATABASE_URL
#                          (e.g. apkzio-db-url).
#
# Optional env:
#   IMAGE_TAG            — defaults to "latest". Use a SHA in CI for traceability.
#   GCP_REGION           — defaults to "asia-southeast1".
#   SERVICE_NAME         — defaults to "apkzio-dispatcher".
#   MIN_INSTANCES        — defaults to "2".
#   MAX_INSTANCES        — defaults to "20".
#   WORKER_CONCURRENCY   — internal async slots per pod, defaults to "4".
#   POLL_INTERVAL_MS     — claim poll interval, defaults to "2000".

set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT is required}"
: "${FCM_SECRET_NAME:?FCM_SECRET_NAME is required (Secret Manager name for DEFAULT_FCM_CREDENTIALS)}"
: "${DB_SECRET_NAME:?DB_SECRET_NAME is required (Secret Manager name for DATABASE_URL)}"

IMAGE_TAG="${IMAGE_TAG:-latest}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${SERVICE_NAME:-apkzio-dispatcher}"
MIN_INSTANCES="${MIN_INSTANCES:-2}"
MAX_INSTANCES="${MAX_INSTANCES:-20}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-4}"
POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-2000}"

IMAGE="gcr.io/${GCP_PROJECT}/${SERVICE_NAME}:${IMAGE_TAG}"

cd "$(dirname "$0")/backends/firebase-service"

echo "[1/4] docker build → ${IMAGE}"
docker build -t "${IMAGE}" .

echo "[2/4] docker push  → ${IMAGE}"
docker push "${IMAGE}"

echo "[3/4] gcloud run deploy ${SERVICE_NAME}"
gcloud run deploy "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --image="${IMAGE}" \
  --region="${GCP_REGION}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --concurrency=1 \
  --cpu=2 \
  --memory=1Gi \
  --port=8080 \
  --no-allow-unauthenticated \
  --set-secrets="DATABASE_URL=${DB_SECRET_NAME}:latest,DEFAULT_FCM_CREDENTIALS=${FCM_SECRET_NAME}:latest" \
  --set-env-vars="WORKER_CONCURRENCY=${WORKER_CONCURRENCY},POLL_INTERVAL_MS=${POLL_INTERVAL_MS},LOG_LEVEL=info"

echo "[4/4] Health check"
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)')
echo "  service URL: ${URL}"
echo "  curl -s \"${URL}/healthz\" (requires authenticated invoker)"

echo "Done."
