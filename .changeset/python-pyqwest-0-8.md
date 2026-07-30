---
"@e2b/python-sdk": minor
---

Require [`pyqwest`](https://pypi.org/project/pyqwest/) 0.8, which lets the SDK
drop the workarounds it carried for what the HTTP stack could not express
before:

- `proxy` honors an `httpx.Proxy`'s credentials and custom headers as given,
  instead of rejecting headers and folding the credentials into the proxy URL
  userinfo. A per-proxy `ssl_context` remains unsupported.
- Multipart uploads (`files.write`) no longer need the SDK to rewrap httpx's
  request stream on the way to the transport.
- Low-level HTTP logs are available again — the equivalent of the httpcore
  records that moving off the httpx transports removed. pyqwest logs one line
  per request on the `pyqwest.access` logger and request lifecycle records on
  `pyqwest`, both at `DEBUG` and off unless enabled:

  ```python
  import logging

  logging.basicConfig()
  logging.getLogger("pyqwest.access").setLevel(logging.DEBUG)
  # DEBUG pyqwest.access - HTTP Request: POST https://api.e2b.app/sandboxes "HTTP/2 201 Created"
  ```

  The SDK's own `logger` option is unchanged and independent of these.
