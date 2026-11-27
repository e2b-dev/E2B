"""Exact httpx timeouts over pyqwest's httpx adapters.

pyqwest's httpx adapters turn httpx's per-phase timeouts into a single
whole-request deadline equal to ``read + write``. httpx fills both phases
with the same value (``timeout=5`` is ``read=5, write=5``), so through the
plain adapters every timeout took twice as long as configured. The SDK's
adapters rewrite the timeout first, so the deadline is ``max(read, write)``:
one budget of exactly the configured value, like the JS SDK's timers.
"""

from typing import Any, Dict

import httpx
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport


def normalize_timeout_extension(extensions: Dict[str, Any]) -> Dict[str, Any]:
    """Return ``extensions`` with the httpx ``timeout`` rewritten so that
    pyqwest's ``read + write`` sum equals ``max(read, write)``.

    A phase set to ``None`` (no limit) or a missing timeout is left alone, so
    an unlimited request stays unlimited. The input is not mutated: httpx
    shares the extensions dict.
    """
    timeout = extensions.get("timeout")
    if not isinstance(timeout, dict):
        return extensions
    read = timeout.get("read")
    write = timeout.get("write")
    if read is None or write is None:
        return extensions
    return {
        **extensions,
        "timeout": {**timeout, "read": max(read, write), "write": 0.0},
    }


class DeadlinePyqwestTransport(PyqwestTransport):
    """:class:`PyqwestTransport` whose request deadline is exactly the
    configured httpx timeout instead of ``read + write``
    (see :func:`normalize_timeout_extension`)."""

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        request.extensions = normalize_timeout_extension(request.extensions)
        return super().handle_request(request)


class AsyncDeadlinePyqwestTransport(AsyncPyqwestTransport):
    """:class:`AsyncPyqwestTransport` whose request deadline is exactly the
    configured httpx timeout instead of ``read + write``
    (see :func:`normalize_timeout_extension`)."""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        request.extensions = normalize_timeout_extension(request.extensions)
        return await super().handle_async_request(request)
