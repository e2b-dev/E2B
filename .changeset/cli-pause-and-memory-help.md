---
"@e2b/cli": patch
---

Fix `e2b template create --memory-mb` help text to reflect the real default of 1024 MB (was incorrectly stated as 512), and switch `e2b sandbox pause` to call the non-deprecated `Sandbox.pause()` instead of the deprecated `Sandbox.betaPause()` alias.
