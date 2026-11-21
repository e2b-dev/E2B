---
"e2b": patch
"@e2b/python-sdk": patch
---

Keep an E2B client's headers unchanged when the caller later reuses or modifies the header map passed to its constructor. Per-call header overrides still take precedence.
