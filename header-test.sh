#!/bin/bash

set -euo pipefail

# Hardcode your Strava client secret here.
SECRET="49fd8923e03a4a5090468d1bc9ca943e32a947a5"

if [ "$SECRET" = "REPLACE_WITH_STRAVA_CLIENT_SECRET" ]; then
  echo "Update header-test.sh with your Strava client secret before running." >&2
  exit 1
fi

URL="${1:-https://unsmoothly-postcatarrhal-audie.ngrok-free.dev/webhook/strava}"
PAYLOAD='{"aspect_type":"update","event_time":1763613704,"object_id":16511355431,"object_type":"activity","owner_id":139705458,"subscription_id":316197,"updates":{"title":"run/walk"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

echo "POST $URL"
curl -v -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -H "X-Strava-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
