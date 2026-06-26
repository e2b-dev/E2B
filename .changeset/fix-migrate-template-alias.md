---
"@e2b/cli": patch
---

fix(cli): resolve template alias for migrated build scripts when only template_id is set

`e2b template migrate` now looks up the human-readable template alias from the API (or accepts `--alias`) instead of writing the opaque `template_id` into generated `build_prod.py`, which caused 409 alias collisions when rebuilding existing templates.
