---
"e2b": patch
"@e2b/python-sdk": patch
---

fix(sdk): prevent shell injection in MCP config by using proper shell escaping (shlex.quote in Python, shellQuote helper in JS/TS)
