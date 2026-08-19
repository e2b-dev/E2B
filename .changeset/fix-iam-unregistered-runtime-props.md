---
"e2b": patch
---

Fix the network transform IAM guard so unregistered token names that collide with runtime-probed properties (`then`, `toJSON`, `toString`, `valueOf`) are reported as unknown instead of silently resolving to a built-in. Serializing and stringifying the registered tokens still works.

Fixes #1673
