---
'e2b': patch
---

Report `iam.tokens.toJSON`, `.then`, `.toString` and `.valueOf` as unregistered workload tokens in a network `transform` callback. These four names were exempt from the unknown-token guard because the runtime reads them off any object it serializes, awaits or coerces, so referencing one as a token name used to serialize `Bearer undefined` or a built-in's source text into the rule. Such a value carries no placeholder for the egress proxy to resolve, so it was forwarded verbatim and the destination answered 401 on a garbage credential, with no error from E2B. They now throw `InvalidArgumentError` like any other unregistered name — on use rather than on the read, so serializing, awaiting and coercing the map itself keep working. The Python SDK was not affected.

```ts
import { Sandbox, Secret } from 'e2b'

await Sandbox.create({
  iam: {
    tokens: {
      aws: Secret.iamToken({
        audience: 'sts.amazonaws.com',
        tokenType: 'JWT-SVID',
      }),
    },
  },
  network: {
    rules: {
      'api.example.com': [
        {
          // InvalidArgumentError: Network transform references iam token
          // 'then', which is not registered. Registered tokens: 'aws'.
          transform: ({ iam }) => ({
            headers: { Authorization: `Bearer ${iam.tokens.then}` },
          }),
        },
      ],
    },
  },
})
```
