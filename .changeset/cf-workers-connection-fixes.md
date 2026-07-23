---
'e2b': patch
---

Recognize Cloudflare Workers' `Network connection lost` as a dropped sandbox connection so a sandbox killed mid-request surfaces as the health-checked `TimeoutError` (matching Node/Bun/Deno), and fix streaming downloads releasing their pooled connection twice when cancelled while a read was in flight
