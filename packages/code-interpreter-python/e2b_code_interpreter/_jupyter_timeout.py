from typing import Optional

import httpx


def _jupyter_timeout(
    timeout: Optional[float], *, connect: Optional[float] = None
) -> httpx.Timeout:
    """Build the `httpx.Timeout` every Jupyter request derives its deadline from.

    The SDK's pyqwest-backed transport has no per-phase timeouts: it collapses
    them into a single whole-request deadline, derived as the sum of the
    `read` and `write` phases (`connect` and `pool` are ignored). The whole
    budget therefore goes on `read` and `write` stays at zero, which makes the
    deadline `timeout` and not `2 * timeout`. This matches the JS SDK, which
    aborts the execution on a `timeout`-long timer. A `None` timeout disables
    the deadline entirely and sets no phase at all — the transport still bounds
    connect on its own.
    """
    if timeout is None:
        return httpx.Timeout(None)
    return httpx.Timeout(timeout, write=0, connect=connect)
