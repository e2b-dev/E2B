---
'@e2b/cli': patch
---

Escape quotes, backslashes and newlines in every string the `e2b template migrate` generator interpolates into the generated `template.ts` / `template.py`, so Dockerfile `RUN` commands, heredoc bodies, `WORKDIR`, `USER`, `ENV` names and values, and `COPY` paths containing quotes (or heredocs) no longer produce generated template files with syntax errors.
