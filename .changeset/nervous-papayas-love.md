---
'@e2b/python-sdk': minor
'e2b': minor
---

**Changelog**

- Added new error classes: `BuildError`, `FileUploadError`.
- Added template API endpoints to API Client generation (Python).
- Updated API Clients error handling to throw `BuildError` in addition to `SandboxError`.
- Exported Template and TemplateAsync classes as well as `wait_for_file`, `wait_for_url`, `wait_for_port`, `wait_for_process`, `wait_for_timeout` functions.
- Moved `getRuntime` utility method from api to utils.
- Browser is supported except file operations (COPY). Incompatible modules are not bundled, using dynamic imports (`tar`, `glob`) in supported environments (Node, Deno, Bun) instead.
- Basic tests were added, subject to expansion in a follow-up PR.
- Breaking: Before, 401 error was raising `SandboxError`, which was incorrect, now it will raise `AuthenticationError`. I have also changed the `AuthenticationError` to extend `Error` class, not `SandboxError` anymore as it's now thrown by both Sandbox and Template.
