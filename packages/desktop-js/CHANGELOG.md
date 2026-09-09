# @e2b/desktop

## 2.4.0

### Minor Changes

- 390a1bf: Add an `E2B` client to the Desktop SDKs that binds the connection configuration explicitly, so the API key and domain no longer have to come from the environment variables: `new E2B({ apiKey, domain }).Sandbox.create()` in JavaScript and `E2B(api_key=..., domain=...).Sandbox.create()` in Python. The client exposes the package's own `Sandbox` together with the core `Volume`, `Template` and `Secret` resources, per-call options still take precedence, and multiple clients are isolated from each other and from the env-configured top-level exports.

### Patch Changes

- Updated dependencies [cd921aa]
- Updated dependencies [1980d6b]
- Updated dependencies [043d050]
- Updated dependencies [3289fdc]
  - e2b@2.47.0

## 2.3.4

### Patch Changes

- ba1587f: Wait for the XFCE session to be fully ready before returning a new Desktop sandbox, and clean up the sandbox if desktop startup fails.

## 2.3.3

### Patch Changes

- e1532e9: Move the Code Interpreter and Desktop JavaScript and Python SDKs into the E2B monorepo.
- Updated dependencies [d4a7f41]
  - e2b@2.46.1

## 2.3.2

### Patch Changes

- c5406b0: Update `e2b` (js → `2.38.3`, python → `2.38.0`)
