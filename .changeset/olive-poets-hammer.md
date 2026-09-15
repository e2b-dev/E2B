---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove SDK-side defaults from API request payloads so the API defaults apply when options are omitted. Sandbox create/fork/connect no longer preset a 5-minute timeout, fork no longer presets `count: 1`, create no longer presets `secure: true` or `allow_internet_access`, pause no longer presets keeping memory, and template builds no longer preset CPU/memory. Explicitly provided values are still sent unchanged. Note: until the API-side defaults for `secure` and connect `timeout` are deployed, omitting them changes behavior (sandboxes are created unsecured and connect requests without a timeout are rejected).
