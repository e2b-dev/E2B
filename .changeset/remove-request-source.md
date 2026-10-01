---
"e2b": patch
"@e2b/python-sdk": patch
"@e2b/code-interpreter": patch
"@e2b/code-interpreter-python": patch
---

Remove the `E2B_USER_AGENT_SOURCE` environment variable. The SDKs no longer add a `source/<value>` User-Agent token, append `?source=` to Code Interpreter requests, or log trace IDs and add `(trace_id=…)` to error messages when it is set to `ci`, so SDK behavior no longer depends on that variable.

Code Interpreter errors for statuses other than 404 and 502 now use the same `<status> <reason>[: <body>]` message in JS and Python: JS includes the response body, and Python falls back to the reason phrase when the body is empty.
