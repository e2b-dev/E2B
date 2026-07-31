# @e2b/python-sdk

## 2.36.0

### Minor Changes

- 1504fbc: Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder (`from_fedora_image`, `from_alpine_image`, `from_arch_image` in the Python SDK), alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`). Fedora and Alpine default to pinned tags (`fedora:44`, `alpine:3.24`) so builds stay reproducible; Arch defaults to `latest` because it is a rolling release and provisioning runs `pacman -Syu` regardless.

### Patch Changes

- 6733f36: Align the Python SDK's `from_fedora_image` and `from_alpine_image` defaults with the JS SDK: `fedora:44` and `alpine:3.24`, replacing `fedora:42` (end-of-life, so its repositories leave the normal mirror network and provisioning can fail) and `alpine:3.22`. Callers that omit the variant now get the same base image in both SDKs, and both tags are the ones the orchestrator's distro build tests cover. Also corrects the JS `TemplateFromImage` type docs, which still named the old defaults.
- 45d2679: Regenerate `e2b/sandbox/mcp.py` with `datamodel-code-generator` 0.64.0: the MCP server option types now use builtin generics (`list[str]`, `dict[str, Any]`) and are closed `TypedDict`s, mirroring the spec's `additionalProperties: false`. Raises the `typing-extensions` floor to `>=4.10.0`, the first release accepting PEP 728's `closed`.
- ee0ad25: Update snapshot docstrings to use project terminology instead of team (e.g. "my-project/my-snapshot", project slug)
