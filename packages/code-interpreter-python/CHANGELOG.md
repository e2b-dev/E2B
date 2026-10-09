# @e2b/code-interpreter-python

## 2.10.5

### Patch Changes

- 29064bc: Require `e2b>=2.55.1`, the first release with `get_sandbox_url(..., port=)`. 2.10.4 failed with `TypeError: ... unexpected keyword argument 'port'` when installed with e2b 2.55.0.
- Updated dependencies [29064bc]
  - @e2b/python-sdk@2.55.1

## 2.10.4

### Patch Changes

- 0ad4ec1: Send Code Interpreter requests through the unified sandbox endpoint (`sandbox.<domain>`) on supported domains, like the rest of the SDK. Browsers (JS) and other domains keep using the per-port sandbox host.

## 2.10.3

### Patch Changes

- cd4c62b: Publish the changes from the previous release, which was versioned but failed to publish to npm and PyPI.

## 2.10.2

### Patch Changes

- b3bb653: Remove the `E2B_USER_AGENT_SOURCE` environment variable. The SDKs no longer add a `source/<value>` User-Agent token, append `?source=` to Code Interpreter requests, or log trace IDs and add `(trace_id=…)` to error messages when it is set to `ci`, so SDK behavior no longer depends on that variable.

  Code Interpreter errors for statuses other than 404 and 502 now use the same `<status> <reason>[: <body>]` message in JS and Python: JS includes the response body, and Python falls back to the reason phrase when the body is empty.

## 2.10.1

### Patch Changes

- 2f92cc3: Pin the Jupyter transport to HTTP/1.1 with `get_transport(config, http_version="1.1")`, following the renamed argument in `e2b` 2.52.0 (now the minimum supported version).

## 2.10.0

### Minor Changes

- 390a1bf: Add an `E2B` client to the Code Interpreter SDKs that binds the connection configuration explicitly, so the API key and domain no longer have to come from the environment variables: `new E2B({ apiKey, domain }).Sandbox.create()` in JavaScript and `E2B(api_key=..., domain=...).Sandbox.create()` in Python. The client exposes the package's own `Sandbox` (and `AsyncSandbox` in Python) together with the core `Volume`, `Template` and `Secret` resources, per-call options still take precedence, and multiple clients are isolated from each other and from the env-configured top-level exports.

## 2.9.3

### Patch Changes

- 5a56c87: Bump past 2.9.2, which was already published to PyPI from the pre-migration e2b-dev/code-interpreter repository with different file contents, causing `uv publish --check-url` to fail during release.

## 2.9.2

### Patch Changes

- e1532e9: Move the Code Interpreter and Desktop JavaScript and Python SDKs into the E2B monorepo.

## 2.9.1

### Patch Changes

- 8d0a81b: Bump E2B SDK dependency: JavaScript to 2.39.0, Python to 2.39.1.

  The Python floor is 2.39.1 specifically: e2b 2.38.0 moved the SDK's HTTP stack onto [`pyqwest`](https://pypi.org/project/pyqwest/) and dropped the `http2` parameter that Jupyter requests rely on to pin HTTP/1.1, so any e2b in `>=2.38.0, <2.39.1` raises `TypeError` on every code execution. 2.39.1 restores it.

  Also fixes `run_code`'s `timeout` in the Python SDK. The new transport collapses httpx's per-phase timeouts into a single whole-request deadline and takes the longest phase, so passing `timeout` as the read timeout alongside `request_timeout` on the write and pool phases made the effective deadline `max(timeout, request_timeout)` — any `timeout` shorter than `request_timeout` (60s by default) was ignored and the execution ran on until `request_timeout`. `timeout` now bounds the request on its own, and `timeout=0` disables the deadline instead of inheriting the connect timeout.
