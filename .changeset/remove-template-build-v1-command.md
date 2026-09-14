---
'@e2b/cli': patch
---

Removed the hidden `e2b template build` command (alias `bd`). It printed a V1 deprecation notice and exited 1; the V1 build system it fronted is gone from the API. A script still calling it now gets commander's unknown-command error with the same exit code. Build templates with `e2b template create` or the Template SDK; `e2b template migrate` still converts a V1 project (see https://e2b.dev/docs/template/migration-v2).
