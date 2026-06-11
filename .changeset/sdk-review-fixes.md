---
"@e2b/python-sdk": patch
"e2b": patch
---

Fix a batch of connection-handling bugs in the JS and Python SDKs:

- **Python**: HTTP transport caches now key on the configured proxy, so clients created with different (or no) proxy settings no longer silently reuse a transport built for the first proxy seen.
- **Python**: `request_timeout` is now applied to control-plane (E2B API) requests; previously the underlying httpx client was built with no timeout at all.
- **Python**: the server-stream parser no longer stalls (or drops the final envelope) when the remaining payload of an envelope is shorter than the 5-byte envelope header.
- **JS + Python**: passing `debug: false` explicitly now overrides the `E2B_DEBUG=true` environment variable instead of being ignored.
- **JS**: `timeoutMs: 0` on streaming calls (commands, PTY, watch) now disables the timeout as documented; previously connect-es treated it as an immediately exceeded deadline and aborted the stream right away.
