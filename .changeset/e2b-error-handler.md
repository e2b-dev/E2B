---
"e2b": minor
---

Add `E2B_ERROR_HANDLER` environment variable for routing process-wide fatal errors (uncaught exceptions, unhandled promise rejections, and CLI command failures) to an external executable as a structured JSON payload. The handler receives a single argv entry with `{ schemaVersion, reason, timestamp, pid }` fields; `shell: false`, `detached: true`, `stdio: 'ignore'`, and `env: { PATH }` are used so the handler cannot read other E2B runtime secrets. Mirrors the `OPENCLAW_ERROR_HANDLER` contract established in `openclaw/openclaw#93310`.