---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove SDK-side defaults from API request payloads so the API defaults apply when options are omitted. Sandbox create/fork no longer preset a 5-minute timeout, fork no longer presets `count: 1`, create no longer presets `allow_internet_access` (sandboxes remain `secure` by default), pause no longer presets keeping memory, and template builds no longer preset CPU/memory. Explicitly provided values are still sent unchanged. `connect` keeps the SDK's 5-minute default because the API requires the `timeout` field in the connect request.
