---
"@e2b/python-sdk": patch
---

Sandbox `commands`/`files` traffic is now balanced across HTTP/2 connections the way the JS SDK's undici agent does it, instead of being sharded into a fixed number of pools by sandbox ID. Every request goes to the connection with the fewest streams in flight to its host; a new connection is dialed only when all existing ones already carry `E2B_STREAMS_PER_CONNECTION` streams to that host (default `100`), up to `E2B_MAX_CONNECTIONS` (default `200`). Envd RPC and HTTP calls share the same connections. `E2B_ENVD_POOL_SHARDS` and the `pool_shard` argument of the internal transport factories (`get_transport`, `get_httpx_transport`, `get_pyqwest_transport`, `get_envd_transport`) are removed.
