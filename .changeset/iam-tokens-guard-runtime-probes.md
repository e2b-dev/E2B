---
'e2b': patch
'@e2b/python-sdk': patch
---

Close the holes that let a network `transform` callback read an unregistered workload token without the guard noticing.

In the JS SDK, `iam.tokens` exempted the four names the runtime reads off any object it serializes, awaits or coerces — `toJSON`, `then`, `toString` and `valueOf` — so referencing one of them as a token name resolved to `undefined` or to the source of a built-in function and shipped `Bearer undefined` to the destination. They now resolve to a stand-in that stays inert for the runtime and throws `InvalidArgumentError` the moment a callback interpolates it, so every unregistered name fails at sandbox creation and `JSON.stringify(iam.tokens)`, `await` and `String(iam.tokens)` keep working.

`Object.getOwnPropertyDescriptor(iam.tokens, name)` is checked the same way, since `?.value` was a second path to the same silent `undefined`. `iam.tokens` is also read-only now: assigning a name that the sandbox never registered, or deleting one it did, used to defeat the check or make it contradict itself (`delete iam.tokens.aws` left the error reporting `'aws'` as both unregistered and registered). Python's mapping already rejected every lookup form; it now rejects item assignment and deletion with `InvalidArgumentException` instead of `TypeError`.

```ts
import { Sandbox, Secret } from 'e2b'

await Sandbox.create({
  iam: {
    tokens: {
      aws: Secret.iamToken({ audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' }),
    },
  },
  network: {
    allowOut: ({ rules }) => [...rules.keys()],
    rules: {
      'api.example.com': [
        {
          transform: ({ iam }) => ({
            // Each of these now throws InvalidArgumentError before the request
            // is sent, listing the registered token names.
            headers: { Authorization: `Bearer ${iam.tokens.then}` },
          }),
        },
      ],
    },
  },
})
```

```python
from e2b import Sandbox

# InvalidArgumentException: Cannot assign iam token 'gcp': ctx.iam.tokens is a
# read-only view of the tokens the sandbox registers.
def transform(ctx):
    ctx.iam.tokens["gcp"] = "${e2b.identity.tokens.gcp}"
    return {"headers": {"Authorization": f"Bearer {ctx.iam.tokens['gcp']}"}}
```
