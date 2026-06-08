#!/bin/bash
# ============================================================
# 8_OA_AS Health Check Script
# EC2에서 배포 후 상태 확인용
#
# 사용법:
#   ./healthcheck.sh              # 기본 (localhost:3000/api/health)
#   ./healthcheck.sh 10.0.1.100   # 특정 호스트
# ============================================================

HOST="${1:-localhost}"
PORT="${PORT:-3000}"
ENDPOINT="${ENDPOINT:-/api/health}"
MAX_RETRIES="${MAX_RETRIES:-5}"
RETRY_DELAY="${RETRY_DELAY:-3}"

URL="http://${HOST}:${PORT}${ENDPOINT}"

echo "=== 8_OA_AS Health Check ==="
echo "Target: ${URL}"
echo ""

for i in $(seq 1 $MAX_RETRIES); do
    HTTP_CODE=$(curl -s -o /tmp/oaas_health.json -w "%{http_code}" "${URL}" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Health Check PASSED (HTTP ${HTTP_CODE})"
        echo ""
        echo "Response:"
        cat /tmp/oaas_health.json | python3 -m json.tool 2>/dev/null || cat /tmp/oaas_health.json
        echo ""

        # DB 상태 확인 (response에 'database' 필드 있을 경우)
        DB_STATUS=$(cat /tmp/oaas_health.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('database','unknown'))" 2>/dev/null || echo "unknown")
        if [ "$DB_STATUS" = "error" ] || [ "$DB_STATUS" = "down" ]; then
            echo "⚠️  WARNING: Database status reported '${DB_STATUS}'"
            rm -f /tmp/oaas_health.json
            exit 1
        fi

        rm -f /tmp/oaas_health.json
        exit 0
    fi

    echo "  Attempt ${i}/${MAX_RETRIES}: HTTP ${HTTP_CODE} - retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

echo ""
echo "❌ Health Check FAILED after ${MAX_RETRIES} attempts"
rm -f /tmp/oaas_health.json
exit 1
