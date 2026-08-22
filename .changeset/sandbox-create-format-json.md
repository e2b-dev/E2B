---
'@e2b/cli': minor
---

Add `--format` to `e2b sandbox create`, matching `sandbox list`, `sandbox info` and `sandbox snapshot list`.

`--format json` prints the created sandbox as JSON returned by the API and skips the terminal (it implies `--detach`), so the sandbox ID and the rest of its metadata can be piped into other tooling. `--format pretty` stays the default and is unchanged.

```bash
$ e2b sandbox create --format json
{
  "sandboxId": "i5v2rjxi5c9j0lltm93rc",
  "templateId": "base",
  "state": "running",
  ...
}

$ SBX=$(e2b sandbox create -f json | jq -r .sandboxId)
$ e2b sandbox exec $SBX -- echo hello
```
