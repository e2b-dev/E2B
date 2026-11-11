---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

Click coordinates are honored at `0`: `leftClick(0, 100)` (JS) / `left_click(0, 100)` (Python) moves the cursor to the requested position before clicking instead of silently skipping the move (the coordinate was previously treated as falsy). Passing only one of `x`/`y` now raises the same "Both x and y must be provided together" error on every click method in both SDKs (previously only Python's `right_click` validated this, and its docstring sat after the validation raise so `__doc__` was `None`).
