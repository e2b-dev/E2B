---
"e2b": minor
"@e2b/python-sdk": minor
---

Replace the per-call `integration` connection option with a set-once, process-wide `ConnectionConfig.setIntegration()` (JS) / `ConnectionConfig.set_integration()` (Python). Integrations wrapping the SDK call it once at startup and every request is attributed via the `User-Agent` header — no more threading the option through individual SDK calls. The method is internal and hidden from docs. The `integration` option on `ConnectionConfigOpts` (JS) and the `integration` keyword argument on `ConnectionConfig` (Python) are removed; `ConnectionConfigOpts` remains as a deprecated alias of `ConnectionOpts`. In Python, an explicitly provided `User-Agent` header now always takes precedence over the SDK-built one.
