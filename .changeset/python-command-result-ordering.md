---
"@e2b/python-sdk": patch
---

Fix `CommandHandle` (sync and async) recording the command result after yielding the flushed end-event chunks. The decoders are now flushed and the `CommandResult` is recorded before the trailing chunks are yielded, so a consumer that stops iterating on the first flushed chunk still observes the exit code.
