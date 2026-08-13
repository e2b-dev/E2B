---
'e2b': minor
'@e2b/python-sdk': minor
---

Allow a network rule's `transform` to be a callback, so a workload identity token from the `iam` option can be injected into egress requests without the SDK ever seeing its value. The callback receives placeholder strings that the egress proxy resolves per request — `iam.tokens.aws` is `${e2b.identity.tokens.aws}` on the wire — and referencing a token that is not registered in `iam.tokens` fails with `InvalidArgumentError` / `InvalidArgumentException` instead of silently sending a placeholder no token will ever replace.

`updateNetwork` / `update_network` accepts the same callbacks, but its payload carries no `iam` config, so token names cannot be checked there and every name resolves to its placeholder.

Token names are validated where they are registered and again before they are interpolated: a name cannot be empty or contain `{`, `}` or control characters, since the proxy reads a placeholder up to its first `}` and a brace in the name would resolve a different token than the one referenced.

```ts
import { Sandbox, Secret } from 'e2b'

const sandbox = await Sandbox.create({
  iam: {
    tokens: {
      aws: Secret.iamToken({ audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' }),
    },
  },
  network: {
    allowOut: ({ rules }) => [...rules.keys()],
    rules: {
      'api.internal.example.com': [
        {
          transform: ({ iam }) => ({
            headers: { Authorization: `Bearer ${iam.tokens.aws}` },
          }),
        },
      ],
    },
  },
})
```

```python
from e2b import Sandbox, Secret

sandbox = Sandbox.create(
    iam={
        "tokens": {
            "aws": Secret.iam_token(audience="sts.amazonaws.com", token_type="JWT-SVID"),
        },
    },
    network={
        "allow_out": lambda ctx: list(ctx.rules.keys()),
        "rules": {
            "api.internal.example.com": [
                {
                    "transform": lambda ctx: {
                        "headers": {"Authorization": f"Bearer {ctx.iam.tokens['aws']}"},
                    },
                },
            ],
        },
    },
)
```
