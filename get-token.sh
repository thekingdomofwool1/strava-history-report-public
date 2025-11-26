#!/usr/bin/env bash

# Helper script to guide you through Strava's OAuth flow and fetch an
# access token that includes activity:write scope. Replace the values below
# with the client information from https://www.strava.com/settings/api.
# curl -G https://www.strava.com/api/v3/push_subscriptions -d client_id=186096 -d client_secret=49fd8923e03a4a5090468d1bc9ca943e32a947a5


set -euo pipefail

CLIENT_ID="186096"
CLIENT_SECRET="49fd8923e03a4a5090468d1bc9ca943e32a947a5"
REDIRECT_URI="http://localhost/exchange" # Must match the value registered with Strava
SCOPES="activity:read,activity:read_all,activity:write"
STATE="strava-cli-test"

if [[ "$CLIENT_ID" == "REPLACE_WITH_CLIENT_ID" || "$CLIENT_SECRET" == "REPLACE_WITH_CLIENT_SECRET" ]]; then
  echo "Update CLIENT_ID and CLIENT_SECRET in get-token.sh before running." >&2
  exit 1
fi

AUTHORIZE_URL="https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&approval_prompt=force&scope=${SCOPES}&state=${STATE}"

cat <<EOF
1. Visit the URL below in your browser (already includes activity:write scope):
   ${AUTHORIZE_URL}
2. Authorize the application. Strava will redirect you to ${REDIRECT_URI}?code=...&scope=...
3. Copy the "code" query parameter value from the redirected URL and paste it here.
EOF

read -rp "Paste authorization code: " AUTH_CODE

echo "Exchanging code for tokens..."
RESPONSE=$(curl -sS -X POST https://www.strava.com/api/v3/oauth/token \
  -d client_id="${CLIENT_ID}" \
  -d client_secret="${CLIENT_SECRET}" \
  -d code="${AUTH_CODE}" \
  -d grant_type=authorization_code)

echo
if command -v jq >/dev/null 2>&1; then
  echo "Access token:"
  echo "${RESPONSE}" | jq -r '.access_token'
  echo
  echo "Refresh token:"
  echo "${RESPONSE}" | jq -r '.refresh_token'
  echo
  echo "Full response:"
else
  echo "Install 'jq' for nicer output. Showing raw JSON response:"
fi
echo "${RESPONSE}"
