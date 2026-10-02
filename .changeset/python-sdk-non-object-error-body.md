---
'@e2b/python-sdk': patch
---

Map non-object JSON error bodies to a `SandboxException` instead of crashing. When a proxy or gateway in front of the API or envd returns an error whose body is valid JSON but not an object (a bare string or scalar, e.g. `"upstream connect error"` or `null`), the SDK now surfaces the mapped exception with the HTTP status—matching the JS SDK—rather than raising an opaque `TypeError`/`AttributeError` from the error mapper.
