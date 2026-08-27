---
'@e2b/code-interpreter-python': patch
---

Bump past 2.9.2, which was already published to PyPI from the pre-migration e2b-dev/code-interpreter repository with different file contents, causing `uv publish --check-url` to fail during release.
