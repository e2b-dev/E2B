---
'@e2b/code-interpreter-python': patch
---

Make chart classes dataclasses so pydantic and dataclasses.asdict can serialize Result.chart, including SuperChart.
