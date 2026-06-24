---
"e2b": patch
---

Fix `CommandHandle.disconnect()` leaking the output subscription in the JS SDK. `disconnect()` now cooperatively gates event handling with a flag that is checked before every dispatch, so `onStdout`/`onStderr`/`onPty` are guaranteed not to fire for output that arrives after the call (previously they could keep firing when the underlying HTTP/2 abort did not promptly tear down the stream). The call returns promptly and never blocks on an idle command's stream.
