#!/usr/bin/env bash
# Builds the customer-facing static site into ./dist for a Render Static Site.
#
# The admin interface is deliberately NOT built here — it lives on the Render
# Web Service alongside the API so its session cookie stays same-origin.
set -euo pipefail

rm -rf dist
mkdir -p dist

cp -r frontend/. dist/

# The API host can be overridden at build time: set API_HOST in the Render
# static service's environment. Otherwise the value committed in
# frontend/assets/js/config.js is used.
if [ -n "${API_HOST:-}" ]; then
  HOST_NO_SLASH="${API_HOST%/}"
  sed -i "s|var API_HOST = '[^']*';|var API_HOST = '${HOST_NO_SLASH}';|" dist/assets/js/config.js
  echo "API_HOST set to ${HOST_NO_SLASH}"
fi

# The placeholder catalogue is a development convenience only. Once the API
# is live it is dead weight, so it is dropped from the production build and
# the script tags that reference it are removed.
if [ "${KEEP_SAMPLE_DATA:-false}" != "true" ]; then
  rm -f dist/assets/js/sample-data.js
  sed -i '/sample-data\.js/d' dist/*.html
  echo "Placeholder catalogue removed from the build"
fi

# ---------------------------------------------------------------------------
# Cold-start fix: snapshot the backend's public data at BUILD time instead of
# letting every visitor's browser call the (possibly asleep) free-tier Web
# Service on every page load. The snapshot ships as static JSON alongside the
# HTML/CSS/JS, so browsing is served entirely from Render's static CDN with
# zero cold-start dependency. Content edits in the admin panel still save to
# the database instantly — they just don't reach the public site until this
# build runs again (see the "Website" tab in the admin panel).
#
# Resolve the API host to fetch from: the same one config.js was just
# rewritten to point at.
mkdir -p dist/data

SNAPSHOT_HOST="${API_HOST:-https://belleknits-api.onrender.com}"
SNAPSHOT_HOST="${SNAPSHOT_HOST%/}"

fetch_snapshot() {
  local name="$1"
  local endpoint="$2"
  local out="dist/data/${name}.json"
  local attempt

  for attempt in 1 2 3; do
    if curl -fsS --max-time 45 "${SNAPSHOT_HOST}/api/${endpoint}" -o "${out}"; then
      if node -e "JSON.parse(require('fs').readFileSync('${out}', 'utf8'))" 2>/dev/null; then
        echo "Snapshot OK: ${name} (attempt ${attempt})"
        return 0
      fi
      echo "Snapshot for ${name} was not valid JSON (attempt ${attempt})"
    else
      echo "Snapshot fetch failed for ${name} (attempt ${attempt}) — backend may be cold-starting"
    fi
    sleep 5
  done

  return 1
}

if [ "${SKIP_DATA_SNAPSHOT:-false}" = "true" ]; then
  echo "SKIP_DATA_SNAPSHOT=true — leaving dist/data empty (local/dev build)"
else
  SNAPSHOT_FAILED=0
  fetch_snapshot products "products" || SNAPSHOT_FAILED=1
  fetch_snapshot gallery "gallery" || SNAPSHOT_FAILED=1
  fetch_snapshot settings "settings" || SNAPSHOT_FAILED=1

  if [ "${SNAPSHOT_FAILED}" = "1" ]; then
    echo "ERROR: could not fetch a fresh data snapshot from ${SNAPSHOT_HOST} after retries."
    echo "Aborting the build so Render keeps serving the last good published version,"
    echo "rather than shipping a static site with missing or stale product/gallery data."
    exit 1
  fi

  echo "Data snapshot written to dist/data (products, gallery, settings)"
fi

echo "Static site built into ./dist"
ls dist
