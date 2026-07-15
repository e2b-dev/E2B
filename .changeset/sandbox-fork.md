---
'e2b': minor
---

Add `sandbox.fork()` and `Sandbox.fork(sandboxId)` for forking a running sandbox. The sandbox is checkpointed in place (briefly paused, snapshotted with its full memory state, and resumed — its ID and expiration stay untouched) and `count` new sandboxes are created from that snapshot. Each fork succeeds or fails independently: the returned array contains one entry per requested fork, either a running `Sandbox` instance or an `Error` (`Promise.allSettled`-style). Per-fork error codes map to the same error classes as other API errors (e.g. 429 to `RateLimitError`).

```ts
const sandbox = await Sandbox.create()

const [fork1, fork2] = await sandbox.fork({ count: 2, timeoutMs: 60_000 })
if (fork1 instanceof Sandbox) {
  await fork1.commands.run('echo "hello from fork"')
}
```
