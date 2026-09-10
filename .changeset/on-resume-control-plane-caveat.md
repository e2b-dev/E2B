---
"e2b": patch
"@e2b/python-sdk": patch
---

Document that `onResume` / `on_resume` needs a control plane that knows the option: an older self-hosted or BYOC control plane drops the `memory` field and restores memory while reporting success, instead of rejecting the request.
