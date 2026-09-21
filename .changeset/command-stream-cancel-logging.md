---
"e2b": patch
"@e2b/python-sdk": patch
---

Log the local cause when a command output stream is cancelled. `CommandHandle` (sync and async, in both the Python and JS SDKs) now records, via the logger the sandbox was constructed with, why the stream ended — explicit `disconnect()`, an early stop of iteration/cancellation, or a stream error before the end event — tagged with the command pid, at most once per handle. This is a no-op when no logger is configured, so behavior is unchanged for callers that did not opt into logging. It gives the client-side reason to correlate with the server-side "stream end" line (e2b-dev/E2B#1877, e2b-dev/runtime#3647).
