# @e2b/dockerfile-utils

Dockerfile parser and shell lexer ported from [BuildKit](https://github.com/moby/buildkit/tree/master/frontend/dockerfile) and a `.dockerignore` matcher ported from [moby/patternmatcher](https://github.com/moby/patternmatcher), with no runtime dependencies. Used by the [E2B SDK](https://www.npmjs.com/package/e2b) to implement `Template.fromDockerfile` and to filter the build context.

```ts
import { parseDockerfileAst, ShellLex } from '@e2b/dockerfile-utils'

const ast = parseDockerfileAst(`
FROM node:24 AS build
ENV KEY="a  b" OTHER=c
RUN <<EOF
npm ci
npm run build
EOF
`)

for (const instruction of ast.instructions) {
  console.log(instruction.name, instruction.flags, instruction.args)
}

const lex = new ShellLex(ast.escapeToken)
lex.processWords('KEY="a  b" OTHER=c') // ['KEY=a  b', 'OTHER=c']
```

`parseDockerfileAst` handles parser directives (`# escape=`, `# syntax=`), comments (including inside line continuations), builder flags, JSON/exec forms and heredocs, and reports line numbers and warnings. `ShellLex` splits and unquotes words the way BuildKit does, preserving `$VAR` / `${VAR:-default}` references for later expansion.

```ts
import { PatternMatcher } from '@e2b/dockerfile-utils'

const matcher = new PatternMatcher(['node_modules', '*.log', '!keep.log'])
matcher.matches('node_modules/pkg/index.js') // true
matcher.matches('keep.log') // false
```

`PatternMatcher` applies `.dockerignore` semantics to slash-separated paths relative to the context root: a pattern matching a directory excludes everything under it, and `!` patterns re-include paths (the last matching pattern wins). An invalid pattern throws a plain `Error`.
