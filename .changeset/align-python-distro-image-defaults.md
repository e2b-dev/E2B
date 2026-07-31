---
'e2b': patch
'@e2b/python-sdk': patch
---

Align the Python SDK's `from_fedora_image` and `from_alpine_image` defaults with the JS SDK: `fedora:44` and `alpine:3.24`, replacing `fedora:42` (end-of-life, so its repositories leave the normal mirror network and provisioning can fail) and `alpine:3.22`. Callers that omit the variant now get the same base image in both SDKs, and both tags are the ones the orchestrator's distro build tests cover. Also corrects the JS `TemplateFromImage` type docs, which still named the old defaults.
