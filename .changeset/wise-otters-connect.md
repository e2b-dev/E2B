---
"e2b": patch
"@e2b/python-sdk": patch
---

Skip the control plane request in `Sandbox.connect()` when running in debug mode, matching the behavior of `Sandbox.create()`. In the Python SDK, `Sandbox.connect()` now also normalizes missing envd and traffic access tokens to `None` instead of leaking the `Unset` sentinel, which previously broke `download_url()`/`upload_url()` for non-secure sandboxes.
