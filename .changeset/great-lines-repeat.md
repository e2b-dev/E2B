---
"@e2b/code-interpreter": patch
---

Fix `readLines` quadratic line reassembly when streaming long single-line outputs (e.g. base64 images, wide DataFrames, large JSON): decode and scan only each new chunk, accumulating line fragments in an array that is joined once per emitted line, instead of appending to and re-scanning a single string buffer on every chunk.
