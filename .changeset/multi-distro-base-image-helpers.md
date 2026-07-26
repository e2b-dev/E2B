---
'e2b': minor
---

Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder, alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`).
