---
'e2b': patch
'@e2b/python-sdk': patch
---

Avoid mapping wrong-route JSON 404 responses (`validation error: ...`), HTTP 404 responses whose body code is not `404`, or non-404 HTTP responses with body code `404` to `SandboxNotFoundError` / `SandboxNotFoundException` (or `false` in `kill` and `deleteSnapshot` / `Template.delete`), preserving the HTTP status code and provider message on a generic `SandboxError` / `SandboxException` (or `TemplateError` / `TemplateException`).
