---
"@e2b/python-sdk": patch
---

The internal transport factories (`get_transport`, `get_httpx_transport`, `get_pyqwest_transport` in `e2b.api.client_sync` / `client_async`) now take `shard: Optional[str]` — a sandbox ID, or `None` for the default shard — in place of a `pool_shard` index; the pool index is derived from it internally. `get_envd_transport` is folded into `get_transport(config, shard=envd_shard(config))`. No change to how traffic is distributed.
