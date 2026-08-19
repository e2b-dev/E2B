---
'e2b': patch
---

Detect the sandbox control plane's 404 and 409 responses from the HTTP status instead of the parsed error body. `openapi-fetch` leaves `error` undefined for a non-2xx response that carries no body, so a body-less 404 previously fell through to the generic error handler: `Sandbox.kill()` and `Sandbox.deleteSnapshot()` threw `SandboxError: 404: Not Found` instead of returning `false`, `Sandbox.pause()` threw on an already-paused sandbox instead of returning `false`, and `getInfo`, `getMetrics`, `setTimeout`, `updateNetwork`, `createSnapshot` and `connect` threw a generic `SandboxError` instead of `SandboxNotFoundError`. This matches what `handleApiError`, `Volume` and the Python SDK already do.

```ts
import { Sandbox, SandboxNotFoundError } from 'e2b'

// returns false rather than throwing, whether or not the 404 carries a body
await Sandbox.kill('non-existent-sandbox-id')

try {
  await Sandbox.getInfo('non-existent-sandbox-id')
} catch (err) {
  // now reliably the specific error, so a narrow catch works
  console.log(err instanceof SandboxNotFoundError)
}
```
