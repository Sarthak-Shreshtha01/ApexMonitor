#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${EMAIL:-admin@gmail.com}"
PASSWORD="${PASSWORD:-admin123}"
ORIGIN="${ORIGIN:-http://localhost:3000}"
SDK_VERSION="${SDK_VERSION:-1.0.0}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-5}"
MODE="${1:-both}"
MAX_ITERATIONS="${MAX_ITERATIONS:-0}"
PROJECT_ID="${PROJECT_ID:-}"

rand_int() {
  local min max
  min="$1"
  max="$2"
  node -e "const min=Number(process.argv[1]); const max=Number(process.argv[2]); console.log(Math.floor(Math.random()*(max-min+1))+min)" "$min" "$max"
}

pick() {
  node -e 'const vals=process.argv.slice(1); console.log(vals[Math.floor(Math.random()*vals.length)]);' "$@"
}

section() {
  printf '\n==== %s ====%s' "$1" $'\n'
}

iso_now() {
  node -e "console.log(new Date().toISOString())"
}

minutes_ago_iso() {
  node -e "const minutes = Number(process.argv[1]); console.log(new Date(Date.now() - minutes * 60_000).toISOString())" "$1"
}

random_past_iso() {
  local min_minutes max_minutes
  min_minutes="$1"
  max_minutes="$2"
  node -e "const min=Number(process.argv[1]); const max=Number(process.argv[2]); const mins=Math.random()*(max-min)+min; const ts=Date.now()-Math.floor(mins*60_000); console.log(new Date(ts).toISOString())" "$min_minutes" "$max_minutes"
}

login() {
  local auth_resp
  auth_resp=$(curl -sS -X POST "$BASE_URL/api/v1/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  ACCESS_TOKEN=$(echo "$auth_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.accessToken || "");')
  if [ -z "$ACCESS_TOKEN" ]; then
    echo "Failed to login as $EMAIL"
    exit 1
  fi
}

ensure_user_and_project() {
  local register_resp projects_resp create_project_resp

  register_resp=$(curl -sS -X POST "$BASE_URL/api/v1/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Admin Loop\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || true)

  if echo "$register_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.exit(r.error ? 1 : 0);'; then
    ACCESS_TOKEN=$(echo "$register_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.accessToken || "");')
  else
    login
  fi

  projects_resp=$(curl -sS "$BASE_URL/api/v1/projects" -H "Authorization: Bearer $ACCESS_TOKEN")

  # Prefer provided PROJECT_ID only if this user owns it; otherwise pick first owned project.
  PROJECT_ID=$(echo "$projects_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); const projects=Array.isArray(r.projects)?r.projects:[]; const preferred=process.argv[1]||""; if (preferred) { const p=projects.find(x=>x.id===preferred && x.role==="owner"); if (p) { process.stdout.write(p.id); process.exit(0); } } const owned=projects.find(x=>x.role==="owner"); process.stdout.write(owned?.id || "");' "$PROJECT_ID")

  if [ -z "$PROJECT_ID" ]; then
    create_project_resp=$(curl -sS -X POST "$BASE_URL/api/v1/projects" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{"name":"Loop Project"}')
    PROJECT_ID=$(echo "$create_project_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.project?.id || "");')
  fi

  if [ -z "$PROJECT_ID" ]; then
    echo "No owner project found/created for $EMAIL"
    exit 1
  fi
}

mint_keys() {
  local backend_key_resp rum_key_resp

  backend_key_resp=$(curl -sS -X POST "$BASE_URL/api/v1/auth/keys" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"$PROJECT_ID\",\"label\":\"loop-backend\"}")
  API_KEY=$(echo "$backend_key_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.key || "");')

  rum_key_resp=$(curl -sS -X POST "$BASE_URL/api/v1/auth/rum-keys" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{\"projectId\":\"$PROJECT_ID\",\"label\":\"loop-rum\",\"allowedOrigins\":[\"$ORIGIN\"]}")
  RUM_KEY=$(echo "$rum_key_resp" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(r.key || "");')

  if [ -z "$API_KEY" ] || [ -z "$RUM_KEY" ]; then
    echo "Failed to mint keys"
    echo "PROJECT_ID=$PROJECT_ID"
    echo "BACKEND_KEY_RESPONSE=$backend_key_resp"
    echo "RUM_KEY_RESPONSE=$rum_key_resp"
    exit 1
  fi
}

send_api_batch() {
  local t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 batch resp
  local l1 l2 l3 l4 l5 l6 l7 l8 l9 l10

  l1=$(rand_int 20 120)
  l2=$(rand_int 20 120)
  l3=$(rand_int 30 160)
  l4=$(rand_int 20 140)
  l5=$(rand_int 40 220)
  l6=$(rand_int 15 90)
  l7=$(rand_int 20 120)
  l8=$(rand_int 10 80)
  l9=$(rand_int 100 900)
  l10=$(rand_int 20 140)

  t1=$(random_past_iso 2 30)
  t2=$(random_past_iso 2 30)
  t3=$(random_past_iso 2 30)
  t4=$(random_past_iso 2 30)
  t5=$(random_past_iso 2 30)
  t6=$(random_past_iso 2 30)
  t7=$(random_past_iso 2 30)
  t8=$(random_past_iso 2 30)
  t9=$(random_past_iso 2 30)
  t10=$(random_past_iso 2 30)

  batch=$(cat <<JSON
{
  "projectId": "$PROJECT_ID",
  "sdkVersion": "$SDK_VERSION",
  "logs": [
    {"method":"GET","endpoint":"/api/v1/overview","statusCode":200,"latencyMs":$l1,"ip":"203.0.113.10","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$t1","tags":["overview","dashboard"]},
    {"method":"POST","endpoint":"/api/v1/auth/login","statusCode":401,"latencyMs":$l2,"ip":"203.0.113.11","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) Safari/17.3","timestamp":"$t2","tags":["auth","failure"]},
    {"method":"GET","endpoint":"/api/v1/logs","statusCode":200,"latencyMs":$l3,"ip":"203.0.113.12","userAgent":"Mozilla/5.0 (X11; Linux x86_64) Firefox/125.0","timestamp":"$t3","tags":["logs","search"]},
    {"method":"GET","endpoint":"/api/v1/traces","statusCode":200,"latencyMs":$l4,"ip":"203.0.113.13","userAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile Safari/17.0","timestamp":"$t4","tags":["traces","mobile"]},
    {"method":"PATCH","endpoint":"/api/v1/settings/profile","statusCode":204,"latencyMs":$l5,"ip":"203.0.113.14","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/124.0","timestamp":"$t5","tags":["settings"]},
    {"method":"DELETE","endpoint":"/api/v1/keys/123","statusCode":403,"latencyMs":$l6,"ip":"203.0.113.15","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$t6","tags":["keys","forbidden"]},
    {"method":"GET","endpoint":"/api/v1/rum/overview","statusCode":200,"latencyMs":$l7,"ip":"203.0.113.16","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Chrome/124.0","timestamp":"$t7","tags":["rum","api"]},
    {"method":"POST","endpoint":"/api/v1/rum","statusCode":202,"latencyMs":$l8,"ip":"203.0.113.17","userAgent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0","timestamp":"$t8","tags":["rum","ingest"]},
    {"method":"PUT","endpoint":"/api/v1/projects/$PROJECT_ID","statusCode":500,"latencyMs":$l9,"ip":"203.0.113.18","userAgent":"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/17.3","timestamp":"$t9","tags":["projects","error"]},
    {"method":"GET","endpoint":"/api/v1/metrics/overview","statusCode":200,"latencyMs":$l10,"ip":"203.0.113.19","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0","timestamp":"$t10","tags":["metrics","dashboard"]}
  ]
}
JSON
)

  resp=$(curl -sS -X POST "$BASE_URL/api/v1/ingest" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "$batch")
  echo "$resp"
}

send_web_batch() {
  local t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 batch resp idem
  local ttfb1 ttfb2 ttfb3 ttfb4 ttfb5 ttfb6 ttfb7 ttfb8 ttfb9 ttfb10
  local fcp1 fcp2 fcp3 fcp4 fcp5 fcp6 fcp7 fcp8 fcp9 fcp10
  local lcp1 lcp2 lcp3 lcp4 lcp5 lcp6 lcp7 lcp8 lcp9 lcp10
  local ref1 ref2 ref3 ref4 ref5 ref6 ref7 ref8 ref9 ref10
  local session_suffix visitor_suffix

  session_suffix=$(rand_int 1000 9999)
  visitor_suffix=$(rand_int 1000 9999)

  ttfb1=$(rand_int 70 220); fcp1=$(rand_int 500 1200); lcp1=$(rand_int 1200 3600)
  ttfb2=$(rand_int 70 220); fcp2=$(rand_int 500 1200); lcp2=$(rand_int 1200 3600)
  ttfb3=$(rand_int 70 220); fcp3=$(rand_int 500 1200); lcp3=$(rand_int 1200 3600)
  ttfb4=$(rand_int 70 220); fcp4=$(rand_int 500 1200); lcp4=$(rand_int 1200 3600)
  ttfb5=$(rand_int 70 220); fcp5=$(rand_int 500 1200); lcp5=$(rand_int 1200 3600)
  ttfb6=$(rand_int 70 220); fcp6=$(rand_int 500 1200); lcp6=$(rand_int 1200 3600)
  ttfb7=$(rand_int 70 220); fcp7=$(rand_int 500 1200); lcp7=$(rand_int 1200 3600)
  ttfb8=$(rand_int 70 220); fcp8=$(rand_int 500 1200); lcp8=$(rand_int 1200 3600)
  ttfb9=$(rand_int 70 220); fcp9=$(rand_int 500 1200); lcp9=$(rand_int 1200 3600)
  ttfb10=$(rand_int 70 220); fcp10=$(rand_int 500 1200); lcp10=$(rand_int 1200 3600)

  ref1=$(pick "https://google.com/search?q=apexmonitor" "https://news.ycombinator.com" "https://github.com/apexmonitor")
  ref2=$(pick "https://twitter.com/apexmonitor" "https://x.com/apexmonitor" "direct")
  ref3=$(pick "https://github.com/apexmonitor" "https://producthunt.com" "https://dev.to")
  ref4=$(pick "direct" "https://youtube.com" "https://reddit.com/r/devops")
  ref5=$(pick "https://linkedin.com/company/apexmonitor" "https://bing.com/search?q=apexmonitor" "https://google.com")
  ref6=$(pick "https://bing.com/search?q=apexmonitor" "https://duckduckgo.com" "direct")
  ref7=$(pick "https://google.com/search?q=apexmonitor" "https://newsletter.apexMonitor.tech" "https://medium.com")
  ref8=$(pick "https://x.com/apexmonitor" "https://substack.com" "https://google.com")
  ref9=$(pick "https://reddit.com/r/devops" "https://stackoverflow.com" "direct")
  ref10=$(pick "https://newsletter.apexMonitor.tech" "https://google.com/search?q=apexmonitor" "https://github.com")

  t1=$(random_past_iso 2 30)
  t2=$(random_past_iso 2 30)
  t3=$(random_past_iso 2 30)
  t4=$(random_past_iso 2 30)
  t5=$(random_past_iso 2 30)
  t6=$(random_past_iso 2 30)
  t7=$(random_past_iso 2 30)
  t8=$(random_past_iso 2 30)
  t9=$(random_past_iso 2 30)
  t10=$(random_past_iso 2 30)

  batch=$(cat <<JSON
{
  "sdkVersion": "$SDK_VERSION",
  "events": [
    {"type":"page_view","path":"/overview","referrer":"$ref1","timestamp":"$t1","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb1,"fcpMs":$fcp1,"lcpMs":$lcp1,"metadata":{"route":"/overview","theme":"dark"}},
    {"type":"web_vital","path":"/analytics","referrer":"$ref2","timestamp":"$t2","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb2,"fcpMs":$fcp2,"lcpMs":$lcp2,"metadata":{"route":"/analytics","device":"desktop"}},
    {"type":"page_view","path":"/live-traffic","referrer":"$ref3","timestamp":"$t3","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb3,"fcpMs":$fcp3,"lcpMs":$lcp3,"metadata":{"route":"/live-traffic","browser":"chrome"}},
    {"type":"web_vital","path":"/logs","referrer":"$ref4","timestamp":"$t4","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb4,"fcpMs":$fcp4,"lcpMs":$lcp4,"metadata":{"route":"/logs","device":"mobile"}},
    {"type":"page_view","path":"/traces","referrer":"$ref5","timestamp":"$t5","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb5,"fcpMs":$fcp5,"lcpMs":$lcp5,"metadata":{"route":"/traces","browser":"firefox"}},
    {"type":"page_view","path":"/keys","referrer":"$ref6","timestamp":"$t6","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb6,"fcpMs":$fcp6,"lcpMs":$lcp6,"metadata":{"route":"/keys","device":"tablet"}},
    {"type":"web_vital","path":"/settings","referrer":"$ref7","timestamp":"$t7","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb7,"fcpMs":$fcp7,"lcpMs":$lcp7,"metadata":{"route":"/settings","device":"desktop"}},
    {"type":"page_view","path":"/billing","referrer":"$ref8","timestamp":"$t8","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb8,"fcpMs":$fcp8,"lcpMs":$lcp8,"metadata":{"route":"/billing","plan":"pro"}},
    {"type":"web_vital","path":"/ai-insights","referrer":"$ref9","timestamp":"$t9","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb9,"fcpMs":$fcp9,"lcpMs":$lcp9,"metadata":{"route":"/ai-insights","device":"desktop"}},
    {"type":"page_view","path":"/pricing","referrer":"$ref10","timestamp":"$t10","sessionId":"sess-admin-$session_suffix","visitorId":"visitor-admin-$visitor_suffix","ttfbMs":$ttfb10,"fcpMs":$fcp10,"lcpMs":$lcp10,"metadata":{"route":"/pricing","campaign":"launch"}}
  ]
}
JSON
)

  idem="admin-rum-loop-$(date +%s)-$(rand_int 1000 9999)"

  resp=$(curl -sS -X POST "$BASE_URL/api/v1/rum" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -H "X-RUM-Key: $RUM_KEY" \
    -H "X-Idempotency-Key: $idem" \
    -d "$batch")
  echo "$resp"
}

poll_analytics() {
  local attempt metrics_overview rum_overview

  for attempt in 1 2 3 4 5 6; do
    metrics_overview=$(curl -sS "$BASE_URL/api/v1/metrics/overview?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
    rum_overview=$(curl -sS "$BASE_URL/api/v1/rum/overview?projectId=$PROJECT_ID&timeframe=24h" -H "Authorization: Bearer $ACCESS_TOKEN")
    echo "METRICS_OVERVIEW=$metrics_overview"
    echo "RUM_OVERVIEW=$rum_overview"

    if [ "$(echo "$rum_overview" | node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(r.data?.page_views ?? 0));')" -gt 0 ]; then
      break
    fi
    sleep 1
  done
}

ensure_user_and_project
mint_keys

iteration=0
while :; do
  iteration=$((iteration + 1))
  section "Loop iteration $iteration"

  case "$MODE" in
    api)
      send_api_batch
      ;;
    web)
      send_web_batch
      ;;
    both|all)
      send_api_batch
      send_web_batch
      ;;
    *)
      echo "Unknown mode: $MODE (use api, web, or both)"
      exit 1
      ;;
  esac

  poll_analytics

  if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$iteration" -ge "$MAX_ITERATIONS" ]; then
    break
  fi

  sleep "$INTERVAL_SECONDS"
done