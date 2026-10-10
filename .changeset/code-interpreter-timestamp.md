---
'@e2b/code-interpreter': patch
---

fix(code-interpreter): use the backend timestamp in JS `OutputMessage` — `parseOutput` set `timestamp` to `new Date().getTime() * 1000` (client clock, microseconds), ignoring the `timestamp` the kernel sends with each stdout/stderr message. It now reads `msg.timestamp`, matching the Python SDK and the documented "Unix epoch in nanoseconds" contract.
