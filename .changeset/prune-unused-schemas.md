---
"e2b": patch
"@e2b/python-sdk": patch
---

Generated API clients no longer carry schemas that none of the SDK-facing endpoints reference (admin, cluster/rig, node, team API key and access-token models). Only the internal generated layer changes; the public SDK surface is untouched.
