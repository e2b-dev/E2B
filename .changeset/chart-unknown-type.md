---
'@e2b/code-interpreter-python': patch
---

Map an unrecognized chart `type` to `ChartType.UNKNOWN` instead of raising `ValueError`, matching the JS deserializer.
