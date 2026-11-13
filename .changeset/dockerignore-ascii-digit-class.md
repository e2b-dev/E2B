---
"@e2b/dockerfile-utils-python": patch
---

Keep bracket digit classes in Dockerignore patterns ASCII-only, matching Moby and the JavaScript utility. Non-ASCII decimal digits are no longer excluded by a pattern such as `[\d]`.
