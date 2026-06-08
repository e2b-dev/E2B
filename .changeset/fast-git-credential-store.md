---
"e2b": patch
"@e2b/python-sdk": patch
---

Speed up `sandbox.git.dangerouslyAuthenticate()` by writing Git store credentials directly instead of invoking the configured credential helper chain.
