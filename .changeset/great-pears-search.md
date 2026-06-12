---
"@e2b/python-sdk": patch
---

Fix several issues in the volume content API client:

- `AsyncVolume` HTTP transports are now cached per event loop (and per proxy) instead of a process-wide singleton, and sync transports are cached per thread.
- Volume metadata operations (`list`, `make_dir`, `get_info`, `update_metadata`, `remove`) now respect `request_timeout` (60s by default) instead of running with httpx timeouts disabled.
- `read_file(format="stream")` sends the request eagerly, so errors (e.g. `NotFoundException`) are raised at call time instead of on first iteration, matching the JS SDK.
- Volume content auth no longer falls back to the `E2B_ACCESS_TOKEN` environment variable; it requires the volume token, matching the JS SDK.
- `VolumeConnectionConfig` no longer mutates the caller's `headers` dict.
