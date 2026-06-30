---
"e2b": patch
---

Expose `E2B_ENVD_CONNECTIONS` environment variable to configure the envd REST file API connection pool limit (default remains 10). Previously the connection count was hardcoded with no runtime override, unlike the RPC transport which already supported `E2B_ENVD_RPC_CONNECTIONS`.
