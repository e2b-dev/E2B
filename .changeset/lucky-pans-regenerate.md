---
'@e2b/python-sdk': patch
---

Regenerate `e2b/sandbox/mcp.py` with `datamodel-code-generator` 0.64.0: the MCP server option types now use builtin generics (`list[str]`, `dict[str, Any]`) and are closed `TypedDict`s, mirroring the spec's `additionalProperties: false`. Raises the `typing-extensions` floor to `>=4.10.0`, the first release accepting PEP 728's `closed`.
