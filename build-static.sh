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

echo "Static site built into ./dist"
ls dist
