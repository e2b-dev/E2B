---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder (`from_fedora_image`, `from_alpine_image`, `from_arch_image` in the Python SDK), alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`). Fedora and Alpine default to pinned tags (`fedora:42`, `alpine:3.22`) so builds stay reproducible; Arch defaults to `latest` because it is a rolling release and provisioning runs `pacman -Syu` regardless.
