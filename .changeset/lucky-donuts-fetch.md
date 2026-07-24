---
'e2b': patch
'@e2b/python-sdk': patch
---

Regenerate API clients from the latest specs, which are now synced with Copybara from their source-of-truth repositories (e2b-dev/infra@e2255f0 for the REST and envd specs, belt for the volume-content spec) instead of being copied by hand. Picks up the latest spec changes: named `SandboxTimeoutRequest`/`SandboxSnapshotRequest`/`SandboxRefreshRequest` request schemas, `SandboxNetworkConfig` and `SandboxIam` workload-identity models, the `FILE_TYPE_SYMLINK` filesystem entry type, and deprecation of access-token auth in favor of API keys. Anything the upstream specs mark `x-not-implemented: true` (currently the SOCKS5 egress-proxy config) is excluded from the generated clients. Generated Python client models now list fields in spec order instead of alphabetical order (the tag filtering moved from a custom script to Redocly CLI); construct them with keyword arguments if you don't already
