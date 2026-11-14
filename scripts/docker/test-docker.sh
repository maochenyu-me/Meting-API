#!/usr/bin/env bash
set -euo pipefail

TAG="${TAG:-latest}"
CONTAINER_NAME="meting-api-ci-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}"
PORT="${TEST_PORT:-3000}"
METING_TOKEN="${METING_TOKEN:-ci-only-test-secret-0123456789abcdef0123456789}"

cleanup() {
    status=$?
    if [[ $status -ne 0 ]]; then
        docker logs "$CONTAINER_NAME" 2>/dev/null || true
    fi
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    return "$status"
}
trap cleanup EXIT

docker run -d \
    --name "$CONTAINER_NAME" \
    -e METING_TOKEN="$METING_TOKEN" \
    -e OVERSEAS=1 \
    -p "127.0.0.1:${PORT}:3000" \
    "meting-api:${TAG}" >/dev/null || { echo "Failed to start Docker image"; exit 1; }

for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 3 "http://127.0.0.1:${PORT}/test" >/dev/null; then
        api_code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 \
            "http://127.0.0.1:${PORT}/api?server=netease&type=url&id=ci-health-check")
        if [[ "$api_code" == "401" ]]; then
            echo "Docker image /test and API authentication checks passed on attempt ${attempt}"
            exit 0
        fi
        echo "Docker image API health check returned HTTP ${api_code}"
    fi
    sleep 2
done

echo "Docker image did not become healthy"
docker logs "$CONTAINER_NAME" || true
exit 1
