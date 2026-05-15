---
'e2b': minor
---

Add `signal: AbortSignal` option to JS SDK methods to support cancelling in-flight requests. The signal can be passed to `Sandbox.create`, `Sandbox.connect`, `sandbox.commands.run`, `sandbox.files.*`, volume methods, and other request options. When the signal is aborted, the underlying `fetch` is aborted and the returned promise rejects with an `AbortError`.

`SandboxPaginator.nextItems` and `SnapshotPaginator.nextItems` now accept a `SandboxApiOpts` argument (including `signal`) — when provided, the per-call options override the connection options the paginator was constructed with for that single request.

Same change in the Python SDK: `SandboxPaginator.next_items` / `SnapshotPaginator.next_items` (sync and async) now accept `**opts: ApiParams` (e.g. `api_key`, `domain`, `headers`, `request_timeout`); when provided, the per-call options override the ones the paginator was constructed with.
