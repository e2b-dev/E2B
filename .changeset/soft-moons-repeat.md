---
'e2b': patch
---

Report a sandbox killed mid-request as an actionable `TimeoutError` in the browser. When the connection to a sandbox drops mid-request the SDK probes the sandbox's health to tell a killed sandbox apart from a transient network blip, but the probe only ran for connection-dropped wordings it recognized, and the browser's (`network error`) was missing — so killing a sandbox while a command was running surfaced a generic `SandboxError: [unknown] network error` instead of `TimeoutError: ... The sandbox was killed or reached its end of life while the request was in flight.`
