# @e2b/code-interpreter

## 2.8.3

### Patch Changes

- 0ad4ec1: Send Code Interpreter requests through the unified sandbox endpoint (`sandbox.<domain>`) on supported domains, like the rest of the SDK. Browsers (JS) and other domains keep using the per-port sandbox host.

## 2.8.2

### Patch Changes

- cd4c62b: Publish the changes from the previous release, which was versioned but failed to publish to npm and PyPI.
- Updated dependencies [cd4c62b]
  - e2b@2.53.1

## 2.8.1

### Patch Changes

- af8d7a5: Preserve Unicode characters split across response chunks in code execution output.
- b3bb653: Remove the `E2B_USER_AGENT_SOURCE` environment variable. The SDKs no longer add a `source/<value>` User-Agent token, append `?source=` to Code Interpreter requests, or log trace IDs and add `(trace_id=…)` to error messages when it is set to `ci`, so SDK behavior no longer depends on that variable.

  Code Interpreter errors for statuses other than 404 and 502 now use the same `<status> <reason>[: <body>]` message in JS and Python: JS includes the response body, and Python falls back to the reason phrase when the body is empty.

- Updated dependencies [8f51c9f]
- Updated dependencies [b3bb653]
- Updated dependencies [1de92fc]
  - e2b@2.53.0

## 2.8.0

### Minor Changes

- 390a1bf: Add an `E2B` client to the Code Interpreter SDKs that binds the connection configuration explicitly, so the API key and domain no longer have to come from the environment variables: `new E2B({ apiKey, domain }).Sandbox.create()` in JavaScript and `E2B(api_key=..., domain=...).Sandbox.create()` in Python. The client exposes the package's own `Sandbox` (and `AsyncSandbox` in Python) together with the core `Volume`, `Template` and `Secret` resources, per-call options still take precedence, and multiple clients are isolated from each other and from the env-configured top-level exports.

### Patch Changes

- Updated dependencies [cd921aa]
- Updated dependencies [1980d6b]
- Updated dependencies [043d050]
- Updated dependencies [3289fdc]
  - e2b@2.47.0

## 2.7.2

### Patch Changes

- 84cabc2: Detect a mid-request sandbox kill on Deno, where the disconnect surfaces as a bare `TypeError` message instead of a socket error code, so `runCode` throws the descriptive `TimeoutError` there too
- 84cabc2: Detect a mid-request sandbox kill on Cloudflare Workers, where workerd reports the disconnect as `Network connection lost.` instead of a socket error code, so `runCode` throws the descriptive `TimeoutError` there too
- e1532e9: Move the Code Interpreter and Desktop JavaScript and Python SDKs into the E2B monorepo.
- Updated dependencies [d4a7f41]
  - e2b@2.46.1

## 2.7.1

### Patch Changes

- 8d0a81b: Bump E2B SDK dependency: JavaScript to 2.39.0, Python to 2.39.1.

  The Python floor is 2.39.1 specifically: e2b 2.38.0 moved the SDK's HTTP stack onto [`pyqwest`](https://pypi.org/project/pyqwest/) and dropped the `http2` parameter that Jupyter requests rely on to pin HTTP/1.1, so any e2b in `>=2.38.0, <2.39.1` raises `TypeError` on every code execution. 2.39.1 restores it.

  Also fixes `run_code`'s `timeout` in the Python SDK. The new transport collapses httpx's per-phase timeouts into a single whole-request deadline and takes the longest phase, so passing `timeout` as the read timeout alongside `request_timeout` on the write and pool phases made the effective deadline `max(timeout, request_timeout)` — any `timeout` shorter than `request_timeout` (60s by default) was ignored and the execution ran on until `request_timeout`. `timeout` now bounds the request on its own, and `timeout=0` disables the deadline instead of inheriting the connect timeout.
