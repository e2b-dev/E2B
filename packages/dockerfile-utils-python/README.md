# e2b-docker-utils

Dockerfile parser and shell lexer ported from [BuildKit](https://github.com/moby/buildkit/tree/master/frontend/dockerfile), with no runtime dependencies. Used by the [E2B SDK](https://pypi.org/project/e2b/) to implement `Template.from_dockerfile`.

```python
from e2b_docker_utils import ShellLex, parse_dockerfile_ast

ast = parse_dockerfile_ast(
    """
FROM node:24 AS build
ENV KEY="a  b" OTHER=c
RUN <<EOF
npm ci
npm run build
EOF
"""
)

for instruction in ast.instructions:
    print(instruction.name, instruction.flags, instruction.args)

lex = ShellLex(ast.escape_token)
lex.process_words('KEY="a  b" OTHER=c')  # ['KEY=a  b', 'OTHER=c']
```

`parse_dockerfile_ast` handles parser directives (`# escape=`, `# syntax=`), comments (including inside line continuations), builder flags, JSON/exec forms and heredocs, and reports line numbers and warnings. `ShellLex` splits and unquotes words the way BuildKit does, preserving `$VAR` / `${VAR:-default}` references for later expansion.
