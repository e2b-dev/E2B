---
'e2b': patch
---

Bump the optional `undici8` dependency (`npm:undici@…`) from 8.8.0 to 8.10.0. The pin stays exact and the Node floor is unchanged — undici 8.10.0 still declares `engines.node >= 22.19.0`, matching the SDK's `UNDICI_8_MIN_NODE` gate, so which package `loadUndici()` picks on a given Node version does not change.
