---
'@e2b/python-sdk': patch
---

Spread envd traffic across four HTTP/2 connection pools by default so high-concurrency, long-running streams do not all contend for one connection's stream limit. Set `E2B_ENVD_POOL_SHARDS` before importing the SDK to tune the pool count.
