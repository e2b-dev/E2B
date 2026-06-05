---
"@e2b/python-sdk": patch
"e2b": patch
---

Fix `commands.kill()` / command handle `kill()` leaving child processes running. envd's `SendSignal` only signals the single process it manages, so processes spawned by the command kept running (and kept consuming resources) after `kill()`. `kill()` now terminates the command together with its whole process tree.
