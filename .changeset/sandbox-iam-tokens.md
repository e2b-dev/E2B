---
'e2b': minor
'@e2b/python-sdk': minor
---

Add the `iam` option to `Sandbox.create` for configuring sandbox workload identity. Passing a non-empty `tokens` map (name → `{ audience, tokenType }`) enables workload identity for the sandbox:

```ts
const sandbox = await Sandbox.create({
  iam: {
    tokens: {
      aws: { audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' },
    },
  },
})
```

```python
sandbox = Sandbox.create(
    iam={
        "tokens": {
            "aws": {"audience": "sts.amazonaws.com", "token_type": "JWT-SVID"},
        },
    },
)
```
