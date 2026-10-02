---
'e2b': minor
'@e2b/python-sdk': minor
---

Replace the third-party Dockerfile parsers (`dockerfile-ast`, `dockerfile-parse`) used by `Template.fromDockerfile` / `Template.from_dockerfile` with a built-in parser ported from BuildKit. Quoted and escaped values in `ENV`/`ARG`/`COPY`, whitespace inside `RUN`/`CMD` arguments, mixed-case `AS` aliases, comments in line continuations, the `# escape=` directive, `COPY --chmod`, heredocs and `ENTRYPOINT` + `CMD` combination are now handled consistently in both SDKs.
