#!/usr/bin/env bash
# "https://unsmoothly-postcatarrhal-audie.ngrok-free.dev/webhook/strava?hub.verify_token=6b2cae0cf523e5589e19ef41b484f2ddc5bb62b2&hub.challenge=test&hub.mode=subscribe" 
# Quick-and-dirty helper to update a Strava activity description via HTTPie.
# Edit the variables below with your Strava API access token, the activity ID,
# and the desired description before running this script.

set -euo pipefail

ACCESS_TOKEN="6b2cae0cf523e5589e19ef41b484f2ddc5bb62b2"
ACTIVITY_ID="16419193946"
NEW_DESCRIPTION="testing whether I can update an activity via the API"

if ! command -v http >/dev/null 2>&1; then
  echo "HTTPie (the 'http' command) is required but was not found in PATH." >&2
  exit 1
fi

http --print=HBhb PUT "https://www.strava.com/api/v3/activities/${ACTIVITY_ID}" \
  "Authorization:Bearer ${ACCESS_TOKEN}" \
  description="${NEW_DESCRIPTION}"
