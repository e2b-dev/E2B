---
'@e2b/python-sdk': patch
---

Volume API: respect an explicitly provided `User-Agent` header instead of silently overwriting it with the SDK default (matches the main connection config and the JS SDK's volume client, which already keep caller-supplied values)
