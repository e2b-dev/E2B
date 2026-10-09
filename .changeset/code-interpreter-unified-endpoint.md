---
'@e2b/code-interpreter': patch
'@e2b/code-interpreter-python': patch
---

Send Code Interpreter requests through the unified sandbox endpoint (`sandbox.<domain>`) on supported domains, like the rest of the SDK. Browsers (JS) and other domains keep using the per-port sandbox host.
