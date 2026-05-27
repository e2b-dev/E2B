---
'@e2b/python-sdk': patch
---

fix(python-sdk): `Template.from_dockerfile` now correctly handles multi-source `COPY`/`ADD` instructions. Previously, only the first source was kept and all intermediate sources were silently dropped; now each source is emitted as its own `copy()` call to the same destination.
