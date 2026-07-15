---
'@e2b/python-sdk': minor
---

Add `sandbox.fork()` / `Sandbox.fork(sandbox_id)` (and the `AsyncSandbox` equivalents) for forking a running sandbox. The sandbox is checkpointed in place (briefly paused, snapshotted with its full memory state, and resumed — its ID and expiration stay untouched) and `count` new sandboxes are created from that snapshot. Each fork succeeds or fails independently: the returned list contains one entry per requested fork, either a running sandbox instance or an exception. Per-fork error codes map to the same exception classes as other API errors (e.g. 429 to `RateLimitException`).

```python
sandbox = Sandbox.create()

fork1, fork2 = sandbox.fork(count=2, timeout=60)
if isinstance(fork1, Sandbox):
    fork1.commands.run('echo "hello from fork"')
```
