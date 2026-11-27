---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

JS: honor the `display` option when `Sandbox.create()` is called with options only, and run noVNC on the `vncPort`/`port` passed to `stream.start()`. Python: generate a stream password when `stream.start()` is called again with auth still enabled, instead of storing the literal password `None`.
