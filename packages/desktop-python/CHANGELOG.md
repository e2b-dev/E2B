# @e2b/desktop-python

## 2.5.0

### Minor Changes

- 390a1bf: Add an `E2B` client to the Desktop SDKs that binds the connection configuration explicitly, so the API key and domain no longer have to come from the environment variables: `new E2B({ apiKey, domain }).Sandbox.create()` in JavaScript and `E2B(api_key=..., domain=...).Sandbox.create()` in Python. The client exposes the package's own `Sandbox` together with the core `Volume`, `Template` and `Secret` resources, per-call options still take precedence, and multiple clients are isolated from each other and from the env-configured top-level exports.

## 2.4.6

### Patch Changes

- ba1587f: Wait for the XFCE session to be fully ready before returning a new Desktop sandbox, and clean up the sandbox if desktop startup fails.

## 2.4.5

### Patch Changes

- de01606: Bump past 2.4.4, which was already published to PyPI from the pre-migration e2b-dev/desktop repository with different file contents, causing `uv publish --check-url` to fail during release.

## 2.4.4

### Patch Changes

- e1532e9: Move the Code Interpreter and Desktop JavaScript and Python SDKs into the E2B monorepo.

## 2.4.3

### Patch Changes

- c5406b0: Update `e2b` (js → `2.38.3`, python → `2.38.0`)
