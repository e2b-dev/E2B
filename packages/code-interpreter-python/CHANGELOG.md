# @e2b/code-interpreter-python

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
