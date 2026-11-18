---
'@e2b/python-sdk': patch
---

Allow async command and PTY output callbacks to await `disconnect()` without cancelling themselves, including callbacks that return an asyncio task. Disconnecting closes the output stream and lets an active callback finish; no later output callbacks are dispatched.
