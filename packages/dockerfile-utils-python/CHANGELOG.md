# @e2b/dockerfile-utils-python

## 0.1.1

### Patch Changes

- 547decc: Require Python 3.11 or newer (Python 3.10 is no longer supported).

## 0.1.0

### Minor Changes

- cc85f69: Initial release: the Dockerfile parser and BuildKit-style shell lexer behind `Template.fromDockerfile` / `Template.from_dockerfile`, and the `.dockerignore` `PatternMatcher` used to filter the build context, published as standalone dependency-free packages (`@e2b/dockerfile-utils` on npm, `e2b-dockerfile-utils` on PyPI).
