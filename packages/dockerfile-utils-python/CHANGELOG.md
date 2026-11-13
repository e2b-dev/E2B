# @e2b/dockerfile-utils-python

## 0.1.2

### Patch Changes

- aec4543: Keep bracket class escapes in Dockerignore patterns ASCII-only, matching Moby and the JavaScript utility. Non-ASCII decimal digits are no longer excluded by a pattern such as `[\d]`, and non-ASCII spaces by a pattern such as `[\s]`.

## 0.1.1

### Patch Changes

- 547decc: Require Python 3.11 or newer (Python 3.10 is no longer supported).

## 0.1.0

### Minor Changes

- cc85f69: Initial release: the Dockerfile parser and BuildKit-style shell lexer behind `Template.fromDockerfile` / `Template.from_dockerfile`, and the `.dockerignore` `PatternMatcher` used to filter the build context, published as standalone dependency-free packages (`@e2b/dockerfile-utils` on npm, `e2b-dockerfile-utils` on PyPI).
