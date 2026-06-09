---
"@e2b/python-sdk": patch
---

fix(python-sdk): stop sending `E2b-Sandbox-Id`/`E2b-Sandbox-Port` headers on the control-plane `connect` request

`Sandbox.connect` was attaching the envd data-plane headers (`E2b-Sandbox-Id`, `E2b-Sandbox-Port`) to the `POST /sandboxes/{id}/connect` API call. These headers belong only on data-plane (filesystem/commands/pty) requests, matching the JS SDK behavior.
