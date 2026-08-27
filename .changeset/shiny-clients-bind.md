---
'@e2b/code-interpreter': minor
'@e2b/code-interpreter-python': minor
e2b: patch
'@e2b/python-sdk': patch
---

Add an `E2B` client to the Code Interpreter SDKs that binds the connection configuration explicitly, so the API key and domain no longer have to come from the environment variables: `new E2B({ apiKey, domain }).Sandbox.create()` in JavaScript and `E2B(api_key=..., domain=...).Sandbox.create()` in Python. The client exposes the package's own `Sandbox` (and `AsyncSandbox` in Python) together with the core `Volume`, `Template` and `Secret` resources, per-call options still take precedence, and multiple clients are isolated from each other and from the env-configured top-level exports.

Binding the configuration to a class now lives on the resource classes themselves (internally), so the core and the downstream clients share one implementation instead of each package generating bound subclasses on its own.
