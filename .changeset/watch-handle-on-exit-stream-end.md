---
"@e2b/python-sdk": patch
---

Invoke the async `WatchHandle` `on_exit` callback when the watching ends for any reason, matching the JS SDK. It receives the exception that ended the watching, or `None` when the event stream ends normally or the watcher is stopped via `stop()`. Previously it was only invoked when the stream failed with an exception.
