---
"@e2b/python-sdk": patch
---

Fix Python SDK header precedence so a custom `Authorization` passed via `api_headers` is no longer overwritten by the deprecated `access_token`. The deprecated access token is now applied before `api_headers`, matching the JS SDK where a custom `Authorization` wins.
