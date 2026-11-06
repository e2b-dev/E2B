---
'@e2b/cli': minor
---

Validate all CLI options and arguments with zod. Invalid values now fail before the command runs, with a message naming the option, e.g. `error: option '-l, --limit <limit>' argument 'abc' is invalid. Sandbox limit must be a non-negative integer.`

Inputs that used to be silently accepted are now rejected:

- `--limit` on `sandbox list` and `sandbox snapshot list` must be a non-negative integer (non-numeric values used to become `NaN`).
- `-e, --env` entries without `=` (e.g. `-e KEY`) are rejected instead of ignored.
- `-m, --metadata` pairs without `=` are rejected instead of ignored, and values may now contain `=`.
- Integer options no longer accept forms like `1e3` or `0x10`.

`--format` (case-insensitive), `--level`, the `template create` name and an odd `--memory-mb` are now rejected when parsed, not after the command starts. Invalid `e2b.toml` files list every invalid field instead of only the first.
