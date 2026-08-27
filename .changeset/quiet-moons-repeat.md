---
'e2b': patch
'@e2b/python-sdk': patch
---

Deprecate the sandbox git module (`sandbox.git`) and its public types and errors. Run git through the commands module instead, e.g. `sandbox.commands.run('git clone <url> repo')`. The module keeps working and will be removed in the next major version.
