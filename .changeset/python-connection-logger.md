---
"@e2b/python-sdk": patch
---

feat(python-sdk): add a `logger` option for request/debug logging

You can now pass a standard library `logging.Logger` to `Sandbox.create` /
`AsyncSandbox.create` (and the static `Sandbox.connect(sandbox_id, ...)`) to
route that sandbox's request/response logs to your own logger. The logger is
stored on the sandbox and propagates to all of its later operations —
including control-plane calls such as `kill`, `pause`, `set_timeout`, and
`get_info`. Matching the JavaScript SDK, `logger` is a construction-time option
and is **not** a per-request parameter that those methods accept from the
caller. The stdlib `logging.Logger` is used directly as the adapter instead of
a custom interface.

The logger is wired into the API client, the envd client, and the RPC
(ConnectRPC) path. Mirroring the JS SDK: requests log at `INFO`, successful API
and unary RPC responses at `INFO`, streamed RPC messages at `DEBUG`, and failed
API responses (status >= 400) at `ERROR`. When no logger is supplied, the SDK
emits no request/response logging at all (also matching the JS SDK).

Volume content operations continue to accept `logger` per call via
`VolumeApiParams`, matching the JS Volume API.

```python
import logging
from e2b import Sandbox

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("my-app.e2b")

sbx = Sandbox.create(logger=logger)
sbx.commands.run("echo hello")  # request/response logged via `logger`
```
