---
"@e2b/cli": patch
---

Fix `e2b template migrate` generating Python build scripts that fail to run as instructed. The generated `build_dev.py` / `build_prod.py` used a package-relative import (`from .template import template`) while the command instructs single-file execution (`python build_dev.py`), causing `ImportError: attempted relative import with no known parent package`. The scripts now use a runnable absolute import (`from template import template`).
