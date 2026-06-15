---
"e2b": patch
---

Throw a clear `Expected start event` error instead of a bare `TypeError` when the process/watch start stream yields no events. Previously the `undefined` start event slipped past the optional-chaining guard and surfaced as `Cannot read properties of undefined (reading 'event')`.
