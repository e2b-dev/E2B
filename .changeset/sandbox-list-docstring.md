---
"@e2b/python-sdk": patch
"e2b": patch
---

Correct `Sandbox.list()` documentation across both SDKs: it returns a paginator (`SandboxPaginator` / `AsyncSandboxPaginator`), not a list, and by default the server returns sandboxes in both `running` and `paused` states. The docstrings now describe the return type accurately and show how to iterate pages via `paginator.next_items()` / `await paginator.nextItems()` while `paginator.has_next` / `paginator.hasNext` is true. No behavior change.
