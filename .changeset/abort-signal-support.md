---
'e2b': minor
---

Add `signal: AbortSignal` option to JS SDK methods to support cancelling in-flight requests. The signal can be passed to `Sandbox.create`, `Sandbox.connect`, `sandbox.commands.run`, `sandbox.files.*`, volume methods, and other request options. When the signal is aborted, the underlying `fetch` is aborted and the returned promise rejects with an `AbortError`.
