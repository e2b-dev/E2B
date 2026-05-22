---
'@e2b/python-sdk': minor
---

Add `http2` parameter to `get_transport` so callers can request an HTTP/1.1
transport (e.g. for streaming endpoints where client cancellation needs to
close the TCP connection so the server detects the disconnect). The cache
is keyed on `http2` so opt-in and opt-out callers get distinct, reusable
transports.
