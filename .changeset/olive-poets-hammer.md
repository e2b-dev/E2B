---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove SDK-side defaults from API request payloads so the API defaults apply when options are omitted. Sandbox create/fork/connect no longer preset a 5-minute timeout, fork no longer presets `count: 1`, create no longer presets `allow_internet_access`, pause no longer presets keeping memory, and template builds no longer preset CPU/memory. Explicitly provided values are still sent unchanged.

Sandbox create and connect now use the v2 API endpoints (`POST /v2/sandboxes`, `POST /v2/sandboxes/{id}/connect`), which default `timeout` to 5 minutes and always secure envd access. The `secure` option on `Sandbox.create` has been removed: every sandbox is secured.
