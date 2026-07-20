---
'e2b': patch
'@e2b/python-sdk': patch
---

Regenerate API clients from the latest specs, which are now synced with Copybara from their source-of-truth repositories (e2b-dev/infra@7bf1311 for the REST and envd specs, belt for the volume-content spec) instead of being copied by hand. Picks up the latest spec changes: named `SandboxTimeoutRequest`/`SandboxSnapshotRequest`/`SandboxRefreshRequest` request schemas, `SandboxNetworkConfig`/`SandboxEgressProxyConfig` models, the `FILE_TYPE_SYMLINK` filesystem entry type, and deprecation of access-token auth in favor of API keys
