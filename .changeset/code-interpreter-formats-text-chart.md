---
'@e2b/code-interpreter': patch
---

fix(code-interpreter): list `text` and `chart` in JS `Result.formats()` — the method reported every available representation except `text` and `chart`, so a result carrying either returned an empty formats list (e.g. a text+chart result reported `[]`). It now appends `text` and `chart` to match the Python SDK's `Result.formats()` ordering.
