---
'@e2b/python-sdk': patch
---

- Fixed `Sandbox.files.read` / `AsyncSandbox.files.read` failing at random for
  files over ~500 KB (and always for a few MB) with `httpx.ReadError ...
  too_many_data_frames`. File downloads now go over HTTP/1.1 regardless of
  `http_version`, as h2 closed HTTP/2 connections after receiving 100 empty
  DATA frames, which the sandbox proxy sends throughout file responses.
- File downloads use their own HTTP/1.1 pool, capped at
  `E2B_MAX_HTTP1_CONNECTIONS` (default `1000`) connections per address.
