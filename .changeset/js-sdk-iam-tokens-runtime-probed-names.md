---
'e2b': patch
---

Close the `iam.tokens` guard in network `transform` callbacks. `toJSON`, `then`, `toString` and `valueOf` were exempt from the unregistered-token check so the runtime could serialize, await and coerce the map, so referencing one as a token name serialized `Bearer undefined` or the source of a built-in instead of raising `InvalidArgumentError`. The runtime's probes are now served without exempting the names, and `iam.tokens` is read-only: assignment, `Object.defineProperty`, `delete` and a lookup through `Object.getOwnPropertyDescriptor` are all rejected. `JSON.stringify(iam.tokens)`, `String(iam.tokens)` and awaiting the map keep working.
