---
'@e2b/code-interpreter': patch
---

Fix `OutputMessage.timestamp` in the JS Code Interpreter to use the backend timestamp (Unix epoch in nanoseconds) sent with each stdout/stderr message, instead of the client clock (`new Date().getTime() * 1000`). The type is unchanged (`number`); this aligns the value with the documented contract and the Python SDK. Because nanosecond epoch values exceed `Number.MAX_SAFE_INTEGER`, the JS value is precise to a few hundred nanoseconds (documented on `OutputMessage.timestamp`).
