---
'@e2b/desktop-python': patch
---

Bump past 2.4.4, which was already published to PyPI from the pre-migration e2b-dev/desktop repository with different file contents, causing `uv publish --check-url` to fail during release.
