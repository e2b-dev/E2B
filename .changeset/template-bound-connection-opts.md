---
'e2b': patch
'@e2b/python-sdk': patch
---

Internal refactor: the template API operations resolve their connection config through a class-level hook, so a `TemplateBase` subclass can carry bound connection options. No behavior change — `Template` / `AsyncTemplate` keep reading config from per-call options and environment variables. In the Python SDK the terminal template operations (`build`, `build_in_background`, `get_build_status`, `exists`, `alias_exists`, `assign_tags`, `remove_tags`, `get_tags`) became `classmethod`s, with signatures unchanged for callers.
