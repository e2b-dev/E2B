---
'e2b': patch
'@e2b/python-sdk': patch
---

Avoid mapping wrong-route JSON 404 responses (`validation error: ...`) or non-404 HTTP responses with body code `404` to `SandboxNotFoundError` / `SandboxNotFoundException` (or `false` in `kill` and `deleteSnapshot` / `Template.delete`), while keeping HTTP status `404` as the deciding check for not-found responses and preserving the status code and provider message on generic `SandboxError` / `SandboxException` (or `TemplateError` / `TemplateException`).
