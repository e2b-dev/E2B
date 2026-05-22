---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove `Sandbox.betaCreate` (JS) and `Sandbox.beta_create` (Python). These methods were a beta of the `lifecycle` configuration that has since shipped on `Sandbox.create`. Migrate by calling `Sandbox.create` with the `lifecycle` option:

```ts
// before
await Sandbox.betaCreate({ autoPause: true })
// after
await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })
```

```python
# before
Sandbox.beta_create(auto_pause=True)
# after
Sandbox.create(lifecycle={"on_timeout": "pause"})
```

The `SandboxBetaCreateOpts` type export (JS) and the `autoPause` / `auto_pause` input on the create path have been removed as part of this change. The wire-level `autoPause` field on `NewSandbox` is unchanged — only the SDK-level surface is affected.
