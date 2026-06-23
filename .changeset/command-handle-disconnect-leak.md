---
"e2b": patch
---

Fix `CommandHandle.disconnect()` leaking the output subscription in the JS SDK. `disconnect()` now cooperatively stops event handling and resolves only after it has fully ended, so `onStdout`/`onStderr`/`onPty` are guaranteed not to fire for output that arrives after the call resolves (previously they could keep firing when the underlying HTTP/2 abort did not promptly tear down the stream). An in-flight callback is abandoned rather than awaited, which also prevents a deadlock when `disconnect()` is awaited from inside a callback.
