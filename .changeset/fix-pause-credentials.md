---
"e2b": patch
---

fix(js-sdk): pass connection config to pause() and betaPause()

The pause() and betaPause() methods were not using the connection config
(including API key) passed to Sandbox.connect(), unlike kill() which
correctly passed the connection config. This caused authentication errors
when calling pause() after connecting to a sandbox with explicit credentials.
