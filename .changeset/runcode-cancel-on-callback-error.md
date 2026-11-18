---
'@e2b/code-interpreter': patch
---

Cancel the `/execute` response body when `runCode` stops reading early (an `onStdout`/`onStderr`/`onResult`/`onError` callback throws, or a line fails to parse). The connection now closes, so the server interrupts the execution instead of letting it run past `timeoutMs` and keep the context busy.
