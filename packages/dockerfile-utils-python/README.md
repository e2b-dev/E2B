# e2b-dockerfile-utils

Dockerfile parser and shell lexer ported from [BuildKit](https://github.com/moby/buildkit/tree/master/frontend/dockerfile) and a `.dockerignore` matcher ported from [moby/patternmatcher](https://github.com/moby/patternmatcher), with no runtime dependencies. Used by the [E2B SDK](https://pypi.org/project/e2b/) to implement `Template.from_dockerfile` and to filter the build context.

```python
from e2b_dockerfile_utils import ShellLex, parse_dockerfile_ast

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

```python
from e2b_dockerfile_utils import PatternMatcher

matcher = PatternMatcher(["node_modules", "*.log", "!keep.log"])
matcher.matches("node_modules/pkg/index.js")  # True
matcher.matches("keep.log")  # False
```

`PatternMatcher` applies `.dockerignore` semantics to slash-separated paths relative to the context root: a pattern matching a directory excludes everything under it, and `!` patterns re-include paths (the last matching pattern wins). An invalid pattern raises a plain `ValueError`.
