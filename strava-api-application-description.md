# Strava API Application Description

We integrate with Strava to add an activity description that provides a link to a Wikipedia article about a location of interest or prominence along your route.

When an activity is recorded, the app receives a webhook notification from Strava and fetches the activity's GPS route. It uses the Wikipedia API to identify a nearby location of interest or prominence, and writes a link to the relevant Wikipedia article back to the activity description via the Strava API.

The app requests `activity:read_all` and `activity:write` scopes only. No activity content is stored. The only data retained is the athlete's Strava ID and OAuth tokens, which are deleted immediately and permanently when the user disconnects their account.

The intended audience is Strava athletes who are curious about the history of the places they pass through and want to share that with their followers.

Obviously they can delete the auto-generated link if they don't like it or would rather write something else.
