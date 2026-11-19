---
'@e2b/code-interpreter-python': patch
---

fix(code-interpreter): collect non-standard MIME types into `Result.extra` in the Python SDK — `Result.__init__` declared an `extra` field for data "not part of the standard types", but unknown keys from the kernel message were dropped via `**kwargs` instead of collected, so non-standard representations (e.g. `application/vnd.plotly.v1+json`, bokeh, vega-lite) were silently lost. They are now swept into `extra`, listed by `formats()`, and preserved by `Execution.to_json()`, matching the JS SDK's `Result` constructor. `serialize_results` reads extra keys from `Result.extra` rather than treating them as attributes.
