---
"@e2b/python-sdk": patch
---

Deduplicate sync sandbox client initialization so envd HTTP and RPC clients are created from the calling thread's transport.
