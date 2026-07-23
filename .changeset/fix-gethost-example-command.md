---
"e2b": patch
---

Fix the `Sandbox.getHost()` documentation example so it can be copy-pasted. The `@example` called `sandbox.commands.exec(...)`, which is not a method on the `Commands` class (it exposes `run`), so running the snippet threw `TypeError: sandbox.commands.exec is not a function`. It now uses `sandbox.commands.run(..., { background: true })`, allowing the long-running HTTP server to start before the example calls `getHost()`. Documentation only, no behavior change.
