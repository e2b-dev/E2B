# @e2b/docker-utils

Dockerfile parser and shell lexer ported from [BuildKit](https://github.com/moby/buildkit/tree/master/frontend/dockerfile), with no runtime dependencies. Used by the [E2B SDK](https://www.npmjs.com/package/e2b) to implement `Template.fromDockerfile`.

```ts
import { parseDockerfileAst, ShellLex } from '@e2b/docker-utils'

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
