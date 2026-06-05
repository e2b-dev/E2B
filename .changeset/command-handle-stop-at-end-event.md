---
'e2b': patch
'@e2b/python-sdk': patch
---

Stop the background command event iterator as soon as the terminal `end` event is received, instead of waiting for envd to close the HTTP stream. This ensures `CommandHandle.wait()` returns promptly once the command result is known, even if the stream close is delayed. The underlying HTTP stream/connection is now also released deterministically in all paths (normal completion, exception, and `disconnect()`), preventing connection-pool exhaustion in workloads that create many command handles.
