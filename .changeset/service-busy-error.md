---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `ServiceBusyError` (JavaScript) / `ServiceBusyException` (Python) for HTTP 503 responses: the API refused the operation because the service or the node running the sandbox is temporarily busy, the sandbox is unchanged, and the call can be retried. A refused `pause()` is the first case. The base `SandboxError` / `SandboxException` also carries the HTTP status as `statusCode` / `status_code` when the error came from an API response, so callers can branch on the status without parsing the message. Existing `catch` blocks keep working: the new classes subclass the base error.
