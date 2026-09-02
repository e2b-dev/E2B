---
'@e2b/python-sdk': patch
---

Improve reliability for high-concurrency sandbox workloads by spreading envd traffic across four HTTP/2 connection pools. Set `E2B_ENVD_POOL_SHARDS` before importing the SDK to adjust the pool count.
