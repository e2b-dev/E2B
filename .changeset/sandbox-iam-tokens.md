---
'e2b': minor
'@e2b/python-sdk': minor
---

Add the `iam` option to `Sandbox.create` for configuring sandbox workload identity, and a `Secret` class with an `idToken` / `id_token` method for defining the workload tokens. Passing a non-empty `tokens` map (name → `{ audience, tokenType }`) enables workload identity for the sandbox:

```ts
import { Sandbox, Secret } from 'e2b'

const sandbox = await Sandbox.create({
  iam: {
    tokens: {
      aws: Secret.idToken({ audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' }),
    },
  },
})
```

```python
from e2b import Sandbox, Secret

sandbox = Sandbox.create(
    iam={
        "tokens": {
            "aws": Secret.id_token(audience="sts.amazonaws.com", token_type="JWT-SVID"),
        },
    },
)
```

Plain `{ audience, tokenType }` objects (`{"audience": ..., "token_type": ...}` dicts in Python) are accepted as token values too.
