---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove `Sandbox.betaPause` (JS) and `Sandbox.beta_pause` (Python). These were deprecated aliases of `pause`. Migrate by calling `pause` instead:

```ts
// before
await sandbox.betaPause()
// after
await sandbox.pause()
```

```python
# before
sandbox.beta_pause()
# after
sandbox.pause()
```
