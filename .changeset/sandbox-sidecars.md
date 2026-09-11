---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `sidecars` to sandbox creation: companion microVMs from the E2B sidecar catalog that run next to the sandbox inside its private network and are reached by the name `{entry}.sidecar.e2b.local`. Each entry names a catalog item (`iron-proxy`, a proxy that swaps a placeholder for the real secret value on egress so the secret never enters the sandbox; `redis`, a cache), with an optional `version`, entry-specific `config`, and `secrets` slots holding `${e2b.secrets.<name>}` references. Sandbox info and list return the attached sidecars with their role, class, state, name, address and ports. Sidecar rejections surface as `InvalidArgumentError` / `InvalidArgumentException` with the API's `sidecar_*` code in the message; a sidecar that fails to start keeps its entry name in the error. Requires the team's `sandbox-sidecars` feature.
