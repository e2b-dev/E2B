---
"@e2b/python-sdk": patch
---

Use the stable sandbox host for envd requests on supported E2B domains and give envd traffic a separate HTTP transport cache from API traffic. Async envd requests continue to use HTTP/2; sync envd requests use HTTP/1.1 to avoid shared HTTP/2 contention under threaded sync workloads.
