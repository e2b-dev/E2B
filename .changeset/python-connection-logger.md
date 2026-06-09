---
"@e2b/python-sdk": patch
---

feat(python-sdk): add a `logger` option for request/debug logging

You can now pass a standard library `logging.Logger` to `Sandbox.create` /
`AsyncSandbox.create` (and `connect`) to route that sandbox's request/response
logs to your own logger. Matching the JavaScript SDK, `logger` is a
construction-time option — it configures the sandbox and is **not** a
per-request parameter on control-plane methods like `kill`/`list`/`get_info`.
The stdlib `logging.Logger` is used directly as the adapter instead of a custom
interface.

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
