---
'@e2b/desktop': minor
'@e2b/desktop-python': minor
---

Click coordinates are honored at `0`: `leftClick(0, 100)` (JS) / `left_click(0, 100)` (Python) moves the cursor to the requested position before clicking instead of silently skipping the move (the coordinate was previously treated as falsy).

**Breaking:** passing only one of `x`/`y` now raises on every click method in both SDKs (previously three of the four methods silently skipped the move, so a lone-coordinate call clicked at the current cursor position). Callers passing a single coordinate must either drop it or pass both coordinates.
