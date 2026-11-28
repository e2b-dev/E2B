---
'e2b': patch
'@e2b/python-sdk': patch
---

`Template().fromDockerfile()` / `from_dockerfile()` now expands `ARG`s declared before `FROM` in the base image, so `ARG VERSION=24` followed by `FROM node:${VERSION}` resolves to `node:24` instead of the literal `node:${VERSION}`.
