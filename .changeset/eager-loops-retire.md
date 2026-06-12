---
"@e2b/python-sdk": patch
---

Key per-event-loop async HTTP transport and client caches by the loop object (held weakly) instead of `id(loop)`. CPython can reuse the id of a closed loop almost immediately, so sequential event loops (for example repeated `asyncio.run(...)` calls) could inherit a transport or client bound to a previous, closed loop. Cache entries are now also released automatically when their loop is garbage collected.
