---
"@e2b/dockerfile-utils": patch
---

Keep bracket whitespace classes in Dockerignore patterns ASCII-only, matching Moby and the Python utility. Non-ASCII spaces such as U+00A0 are no longer matched by a pattern such as `[\s]`.
