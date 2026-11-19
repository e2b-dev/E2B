import httpx

from typing import Optional


def _request_deadline(
    timeout: Optional[float], request_timeout: Optional[float] = None
) -> httpx.Timeout:
    """
    Builds the httpx timeout so the transport derives `timeout` as the
    whole-request deadline.

    The SDK's pyqwest-backed transport collapses httpx's per-phase timeouts
    into a single whole-request deadline by summing the read and write phases
    (see `convert_timeout` in `pyqwest.httpx._transport`). Carrying `timeout`
    on both phases — e.g. `httpx.Timeout(timeout, ...)` — therefore derives
    `2 * timeout`, so the write phase is set to 0, which the transport adds as
    nothing, while `connect` keeps `request_timeout` (defaulting to `timeout`
    when there is no separate connect budget). A `timeout` of None (or 0,
    which the SDK documents as "no limit") leaves the request unbounded; the
    transport still bounds connect on its own.
    """
    if timeout is None or timeout == 0:
        return httpx.Timeout(None)
    connect = request_timeout if request_timeout is not None else timeout
    return httpx.Timeout(connect=connect, read=timeout, write=0, pool=timeout)
