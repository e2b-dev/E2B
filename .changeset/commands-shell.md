---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `shell` option to `commands.run` to run the command in a custom shell, e.g. `shell: ['/bin/sh', '-c']` runs `/bin/sh -c <cmd>` (default stays `['/bin/bash', '-l', '-c']`)
