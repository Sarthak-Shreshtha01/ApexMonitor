#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"
EMAIL="admin123@gmail.com"
PASSWORD="admin123"
ORIGIN="http://localhost:3000"
SDK_VERSION="1.0.0"

json_get() {
  node -e "const r=JSON.parse(process.argv[1]); let v=r; for (const key of process.argv.slice(2)) { v = v?.[key]; } process.stdout.write(v == null ? '' : String(v));" "$1" "$2"
}

now_iso() {
  node -e "console.log(new Date().toISOString())"
}

minutes_ago_iso() {
  node -e "const minutes = Number(process.argv[1]); console.log(new Date(Date.now() - minutes * 60_000).toISOString())" "$1"
}

section() {
  printf '\n==== %s ====\n' "$1"
}

section "1) Health check"
curl -sS "$BASE_URL/health" | node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(data, null, 2));'

section "2) Register or login admin user"
REGISTER_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Admin Smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || true)

if echo "$REGISTER_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.exit(r.error ? 1 : 0);'; then
  AUTH_RESP="$REGISTER_RESP"
  echo "Registered new user."
else
  echo "Register returned an error; logging in instead."
  AUTH_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi

echo "$AUTH_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'
ACCESS_TOKEN=$(echo "$AUTH_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.accessToken || "");')
if [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to get accessToken"
  exit 1
fi

section "3) Discover project"
PROJECTS_RESP=$(curl -sS "$BASE_URL/api/v1/projects" -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$PROJECTS_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'
PROJECT_ID=$(echo "$PROJECTS_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write((r.projects && r.projects[0] && r.projects[0].id) ? r.projects[0].id : "");')
if [ -z "$PROJECT_ID" ]; then
  echo "No project found for the user"
  exit 1
fi

section "4) Mint backend and RUM keys"
API_KEY_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/auth/keys" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"label\":\"admin-backend-smoke\"}")
echo "$API_KEY_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'
API_KEY=$(echo "$API_KEY_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.key || "");')
if [ -z "$API_KEY" ]; then
  echo "Failed to get backend API key"
  exit 1
fi

RUM_KEY_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/auth/rum-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"label\":\"admin-rum-smoke\",\"allowedOrigins\":[\"$ORIGIN\"]}")
echo "$RUM_KEY_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'
RUM_KEY=$(echo "$RUM_KEY_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.key || "");')
if [ -z "$RUM_KEY" ]; then
  echo "Failed to get RUM key"
  exit 1
fi

section "5) Ingest backend log batch"
LOG_T1=$(minutes_ago_iso 12)
LOG_T2=$(minutes_ago_iso 11)
LOG_T3=$(minutes_ago_iso 10)
LOG_T4=$(minutes_ago_iso 9)
LOG_T5=$(minutes_ago_iso 8)
LOG_T6=$(minutes_ago_iso 7)
LOG_T7=$(minutes_ago_iso 6)
LOG_T8=$(minutes_ago_iso 5)
LOG_T9=$(minutes_ago_iso 4)
LOG_T10=$(minutes_ago_iso 3)

LOG_BATCH=$(cat <<JSON
{
  "projectId": "$PROJECT_ID",
  "sdkVersion": "$SDK_VERSION",
  "logs": [
    {"method":"GET","endpoint":"/api/v1/overview","statusCode":200,"latencyMs":42,"ip":"203.0.113.10","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$LOG_T1","tags":["overview","dashboard"]},
    {"method":"POST","endpoint":"/api/v1/auth/login","statusCode":401,"latencyMs":38,"ip":"203.0.113.11","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) Safari/17.3","timestamp":"$LOG_T2","tags":["auth","failure"]},
    {"method":"GET","endpoint":"/api/v1/logs","statusCode":200,"latencyMs":65,"ip":"203.0.113.12","userAgent":"Mozilla/5.0 (X11; Linux x86_64) Firefox/125.0","timestamp":"$LOG_T3","tags":["logs","search"]},
    {"method":"GET","endpoint":"/api/v1/traces","statusCode":200,"latencyMs":55,"ip":"203.0.113.13","userAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile Safari/17.0","timestamp":"$LOG_T4","tags":["traces","mobile"]},
    {"method":"PATCH","endpoint":"/api/v1/settings/profile","statusCode":204,"latencyMs":88,"ip":"203.0.113.14","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/124.0","timestamp":"$LOG_T5","tags":["settings"]},
    {"method":"DELETE","endpoint":"/api/v1/keys/123","statusCode":403,"latencyMs":31,"ip":"203.0.113.15","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$LOG_T6","tags":["keys","forbidden"]},
    {"method":"GET","endpoint":"/api/v1/rum/overview","statusCode":200,"latencyMs":44,"ip":"203.0.113.16","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Chrome/124.0","timestamp":"$LOG_T7","tags":["rum","api"]},
    {"method":"POST","endpoint":"/api/v1/rum","statusCode":202,"latencyMs":25,"ip":"203.0.113.17","userAgent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0","timestamp":"$LOG_T8","tags":["rum","ingest"]},
    {"method":"PUT","endpoint":"/api/v1/projects/$PROJECT_ID","statusCode":500,"latencyMs":430,"ip":"203.0.113.18","userAgent":"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/17.3","timestamp":"$LOG_T9","tags":["projects","error"]},
    {"method":"GET","endpoint":"/api/v1/metrics/overview","statusCode":200,"latencyMs":53,"ip":"203.0.113.19","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$LOG_T10","tags":["metrics","dashboard"]}
  ]
}
JSON
)

BACKEND_INGEST_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$LOG_BATCH")
echo "$BACKEND_INGEST_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'

section "6) Ingest RUM batch"
RUM_T1=$(minutes_ago_iso 12)
RUM_T2=$(minutes_ago_iso 11)
RUM_T3=$(minutes_ago_iso 10)
RUM_T4=$(minutes_ago_iso 9)
RUM_T5=$(minutes_ago_iso 8)
RUM_T6=$(minutes_ago_iso 7)
RUM_T7=$(minutes_ago_iso 6)
RUM_T8=$(minutes_ago_iso 5)
RUM_T9=$(minutes_ago_iso 4)
RUM_T10=$(minutes_ago_iso 3)

RUM_BATCH=$(cat <<JSON
{
  "sdkVersion": "$SDK_VERSION",
  "events": [
    {"type":"page_view","path":"/overview","referrer":"https://google.com/search?q=pulseapi","timestamp":"$RUM_T1","sessionId":"sess-admin-1","visitorId":"visitor-admin-1","ttfbMs":110,"fcpMs":740,"lcpMs":1950,"metadata":{"route":"/overview","theme":"dark"}},
    {"type":"web_vital","path":"/analytics","referrer":"https://twitter.com/pulseapi","timestamp":"$RUM_T2","sessionId":"sess-admin-1","visitorId":"visitor-admin-1","ttfbMs":90,"fcpMs":690,"lcpMs":1720,"metadata":{"route":"/analytics","device":"desktop"}},
    {"type":"page_view","path":"/live-traffic","referrer":"https://github.com/pulseapi","timestamp":"$RUM_T3","sessionId":"sess-admin-2","visitorId":"visitor-admin-2","ttfbMs":140,"fcpMs":820,"lcpMs":2400,"metadata":{"route":"/live-traffic","browser":"chrome"}},
    {"type":"web_vital","path":"/logs","referrer":"direct","timestamp":"$RUM_T4","sessionId":"sess-admin-2","visitorId":"visitor-admin-2","ttfbMs":180,"fcpMs":930,"lcpMs":3100,"metadata":{"route":"/logs","device":"mobile"}},
    {"type":"page_view","path":"/traces","referrer":"https://linkedin.com/company/pulseapi","timestamp":"$RUM_T5","sessionId":"sess-admin-3","visitorId":"visitor-admin-3","ttfbMs":95,"fcpMs":710,"lcpMs":1800,"metadata":{"route":"/traces","browser":"firefox"}},
    {"type":"page_view","path":"/keys","referrer":"https://bing.com/search?q=pulseapi","timestamp":"$RUM_T6","sessionId":"sess-admin-3","visitorId":"visitor-admin-3","ttfbMs":88,"fcpMs":660,"lcpMs":1680,"metadata":{"route":"/keys","device":"tablet"}},
    {"type":"web_vital","path":"/settings","referrer":"https://google.com/search?q=pulseapi","timestamp":"$RUM_T7","sessionId":"sess-admin-4","visitorId":"visitor-admin-4","ttfbMs":120,"fcpMs":780,"lcpMs":2250,"metadata":{"route":"/settings","device":"desktop"}},
    {"type":"page_view","path":"/billing","referrer":"https://x.com/pulseapi","timestamp":"$RUM_T8","sessionId":"sess-admin-4","visitorId":"visitor-admin-4","ttfbMs":102,"fcpMs":720,"lcpMs":1900,"metadata":{"route":"/billing","plan":"pro"}},
    {"type":"web_vital","path":"/ai-insights","referrer":"https://reddit.com/r/devops","timestamp":"$RUM_T9","sessionId":"sess-admin-5","visitorId":"visitor-admin-5","ttfbMs":170,"fcpMs":980,"lcpMs":3400,"metadata":{"route":"/ai-insights","device":"desktop"}},
    {"type":"page_view","path":"/pricing","referrer":"https://newsletter.pulseapi.io","timestamp":"$RUM_T10","sessionId":"sess-admin-5","visitorId":"visitor-admin-5","ttfbMs":115,"fcpMs":760,"lcpMs":2100,"metadata":{"route":"/pricing","campaign":"launch"}}
  ]
}
JSON
)

RUM_INGEST_RESP=$(curl -sS -X POST "$BASE_URL/api/v1/rum" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -H "X-RUM-Key: $RUM_KEY" \
  -H "X-Idempotency-Key: admin-rum-smoke-1" \
  -d "$RUM_BATCH")
echo "$RUM_INGEST_RESP" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'

section "7) Poll analytics/read APIs"
for attempt in 1 2 3 4 5 6; do
  echo "-- attempt $attempt --"
  METRICS_OVERVIEW=$(curl -sS "$BASE_URL/api/v1/metrics/overview?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$METRICS_OVERVIEW" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("METRICS_OVERVIEW=" + JSON.stringify(r, null, 2));'

  METRICS_LATENCY=$(curl -sS "$BASE_URL/api/v1/metrics/latency?projectId=$PROJECT_ID&timeframe=24h&limit=10" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$METRICS_LATENCY" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("METRICS_LATENCY=" + JSON.stringify(r, null, 2));'

  LOGS_LIST=$(curl -sS "$BASE_URL/api/v1/logs?projectId=$PROJECT_ID&page=1&limit=10&search=api" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$LOGS_LIST" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("LOGS=" + JSON.stringify(r, null, 2));'

  RUM_OVERVIEW=$(curl -sS "$BASE_URL/api/v1/rum/overview?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_OVERVIEW" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_OVERVIEW=" + JSON.stringify(r, null, 2));'

  RUM_SERIES=$(curl -sS "$BASE_URL/api/v1/rum/series?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_SERIES" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_SERIES=" + JSON.stringify(r, null, 2));'

  RUM_PATHS=$(curl -sS "$BASE_URL/api/v1/rum/paths?projectId=$PROJECT_ID&timeframe=24h&limit=10" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_PATHS" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_PATHS=" + JSON.stringify(r, null, 2));'

  RUM_DEVICES=$(curl -sS "$BASE_URL/api/v1/rum/devices?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_DEVICES" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_DEVICES=" + JSON.stringify(r, null, 2));'

  RUM_GEO=$(curl -sS "$BASE_URL/api/v1/rum/geo?projectId=$PROJECT_ID&timeframe=24h&limit=10" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_GEO" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_GEO=" + JSON.stringify(r, null, 2));'

  RUM_REFERRERS=$(curl -sS "$BASE_URL/api/v1/rum/referrers?projectId=$PROJECT_ID&timeframe=24h&limit=10" -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "$RUM_REFERRERS" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log("RUM_REFERRERS=" + JSON.stringify(r, null, 2));'

  PAGE_VIEWS=$(echo "$RUM_OVERVIEW" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(r.data?.page_views ?? 0));')
  if [ "$PAGE_VIEWS" -gt 0 ]; then
    break
  fi
  sleep 1
 done

section "8) Optional trace/detail sanity checks"
curl -sS "$BASE_URL/api/v1/traces?projectId=$PROJECT_ID&page=1&limit=5" -H "Authorization: Bearer $ACCESS_TOKEN" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); console.log(JSON.stringify(r, null, 2));'
