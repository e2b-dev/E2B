---
'e2b': major
'@e2b/python-sdk': major
'@e2b/code-interpreter': major
'@e2b/desktop': major
'@e2b/code-interpreter-python': major
'@e2b/desktop-python': major
'@e2b/cli': minor
---

`pause()` now returns a result object instead of a boolean, and takes `force`.

**Breaking:** `Sandbox.pause()` / `SandboxApi.pause()` (JavaScript) and `Sandbox.pause()` / `AsyncSandbox.pause()` (Python) return `SandboxPauseResult` with `paused` (`true` if this call paused the sandbox, `false` if it was already paused) and `forced` (whether the snapshot was taken without the guest agent health check, as reported by the API). Migrate by reading `paused` where the boolean was read: `if (await sandbox.pause())` becomes `if ((await sandbox.pause()).paused)` and `if sandbox.pause():` becomes `if sandbox.pause().paused:`. A plain truthiness check on the result is now always true, so update every call site that branched on the old boolean. `@e2b/code-interpreter` and `@e2b/desktop` re-export `e2b` and subclass its `Sandbox`, and `e2b-code-interpreter` / `e2b-desktop` subclass the Python `Sandbox`, so their `pause()` changes the same way and they take the same major; the Python packages now allow `e2b<4.0.0`.

The node may refuse a pause (HTTP 503 with `error_code: "sandbox_pause_refused"`): the sandbox keeps running and the refusal surfaces as `SandboxPauseRefusedError` (JavaScript) / `SandboxPauseRefusedException` (Python), a subclass of `ServiceBusyError` / `ServiceBusyException` whose message carries the reason. When the reason is an unresponsive sandbox guest agent, the new `force` option (`{ force: true }` / `force=True`) takes the snapshot without the health check; its memory may then not resume, and a resume with `onResume: 'reboot'` / `on_resume="reboot"` recovers the disk state. Unlike other 503s, a refusal carrying this code is not replayed by the SDK's transport retries, in either SDK: it surfaces after a single request. A `204` from an older API is still a successful, unforced pause.

`e2b sandbox pause` takes `-f, --force` and says when the pause was forced. `SANDBOX_PAUSE_REFUSED_ERROR_CODE` is exported from both packages.
