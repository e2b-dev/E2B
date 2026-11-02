---
'@e2b/code-interpreter': patch
---

Fix `OutputMessage.timestamp` in the JS Code Interpreter to use the backend timestamp (Unix epoch in nanoseconds) sent with each stdout/stderr message, instead of the client clock (`new Date().getTime() * 1000`). The type is unchanged (`number`); this aligns the value with the documented contract and the Python SDK.
