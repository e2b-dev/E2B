---
'@e2b/code-interpreter-python': patch
---

Require `e2b>=2.55.1`, the first release with `get_sandbox_url(..., port=)`. 2.10.4 failed with `TypeError: ... unexpected keyword argument 'port'` when installed with e2b 2.55.0.
