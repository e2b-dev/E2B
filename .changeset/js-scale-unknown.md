---
'@e2b/code-interpreter': patch
---

Map unrecognized chart `x_scale`/`y_scale` to `ScaleType.UNKNOWN`, matching Python. Deserialize SuperChart from `elements` so `Result` can run `deserializeChart`.
