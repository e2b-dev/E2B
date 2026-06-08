---
'@e2b/python-sdk': patch
---

Stop the background command event iterator as soon as the terminal `end` event is received, instead of waiting for envd to close the HTTP stream, and release the underlying HTTP stream/connection deterministically in all paths (normal completion, exception, and `disconnect()`). This ensures `CommandHandle.wait()` returns promptly once the command result is known and the connection is not held until garbage collection.
