---
'e2b': patch
'@e2b/python-sdk': patch
---

Route volume-content client generation through redocly bundling (like the envd pipeline) so `x-internal: true` operations are filtered out of generated SDK schemas. The regenerated JS schema only drops four response components no operation referenced; the Python client output is unchanged.
