# @e2b/dockerfile-utils

## 0.1.2

### Patch Changes

- aec4543: Keep bracket whitespace classes in Dockerignore patterns ASCII-only, matching Moby and the Python utility. Non-ASCII spaces such as U+00A0 are no longer matched by a pattern such as `[\s]`.

## 0.1.1

### Patch Changes

- 73a784d: Require Node.js 22 or newer (Node.js 20 is no longer supported).

## 0.1.0

### Minor Changes

- cc85f69: Initial release: the Dockerfile parser and BuildKit-style shell lexer behind `Template.fromDockerfile` / `Template.from_dockerfile`, and the `.dockerignore` `PatternMatcher` used to filter the build context, published as standalone dependency-free packages (`@e2b/dockerfile-utils` on npm, `e2b-dockerfile-utils` on PyPI).
