---
'e2b': patch
---

Report `iam.tokens.toJSON`, `.then`, `.toString` and `.valueOf` as unregistered workload tokens in a network `transform` callback, and reject writing to or deleting from the map. These four names are exempt from the unknown-token guard because the runtime reads them off any object it serializes, awaits or coerces, so referencing one as a token name used to serialize `Bearer undefined` or a built-in's source text into the rule — the egress proxy then dropped the header and forwarded the request, surfacing as a 401 from the destination with no error from E2B. A descriptor lookup of an unregistered name (`Object.getOwnPropertyDescriptor(iam.tokens, 'typo').value`) resolved to `undefined` the same way, and mutating the map made a name look registered without registering it. Serializing, awaiting and coercing the map itself keep working. The Python SDK was not affected.

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
          // now throws InvalidArgumentError: iam token 'then' is not registered
          transform: ({ iam }) => ({
            headers: { Authorization: `Bearer ${iam.tokens.then}` },
          }),
        },
      ],
    },
  },
})
```
