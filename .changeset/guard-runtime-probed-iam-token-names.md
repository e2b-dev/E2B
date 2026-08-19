---
'e2b': patch
---

Report `iam.tokens.toJSON`, `.then`, `.toString` and `.valueOf` as unregistered workload tokens in a network `transform` callback, and reject writing to or deleting from the map. These four names were exempt from the unknown-token guard because the runtime reads them off any object it serializes, awaits or coerces, so referencing one as a token name used to serialize `Bearer undefined` or a built-in's source text into the rule. Such a value carries no placeholder for the egress proxy to resolve, so it was forwarded verbatim and the destination answered 401 on a garbage credential, with no error from E2B. A descriptor lookup of an unregistered name (`Object.getOwnPropertyDescriptor(iam.tokens, 'typo').value`) resolved to `undefined` the same way, and mutating the map made a name look registered without registering it. A name used as a header value without being interpolated is rejected too, where it used to reach the payload as an object or vanish. Serializing, awaiting, coercing, freezing and `in` on the map itself keep working, and `iam.tokens` is now typed `Readonly`, so a write is a compile error as well. The Python SDK was not affected. Note that `Object.hasOwn(iam.tokens, name)` now throws for an unregistered name instead of answering `false` — that answer is what made a descriptor read of a typo silently resolve to `undefined`; spell a presence check `name in iam.tokens`.

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
