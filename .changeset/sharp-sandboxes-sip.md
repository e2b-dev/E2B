---
"@e2b/python-sdk": patch
---

Use the stable sandbox host for envd requests on supported E2B domains and give envd traffic a separate HTTP transport cache from API traffic. Sync envd transports are cached per thread to avoid sharing a single HTTP/2 connection across threaded sync workloads.
