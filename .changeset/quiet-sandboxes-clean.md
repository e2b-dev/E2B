---
"e2b": patch
"@e2b/python-sdk": patch
---

Kill newly created sandboxes when MCP gateway startup fails. The failure now surfaces as `SandboxError` (JS) / `SandboxException` (Python) with a `Failed to start MCP gateway: <stderr>` message instead of a bare command exit error.
