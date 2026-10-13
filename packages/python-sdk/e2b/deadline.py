"""Whole-request deadlines over pyqwest's httpx adapter.

This module stays free of SDK imports: ``e2b.retry`` needs it and is itself
imported by ``e2b.connection_config``, which ``e2b.api`` depends on.
"""

from typing import Any, Dict, Mapping, Optional

import httpx
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport


def request_deadline(extensions: Mapping[str, Any]) -> Optional[float]:
    """Whole-request deadline, in seconds, that an SDK caller attached to a
    request through ``httpx.Timeout``; ``None`` when the request is unbounded.

    The SDK's timeouts (``request_timeout``, ``run_code(timeout=...)``,
    ``upload_timeout``) bound a request end to end, like the JS SDK's
    ``AbortSignal.timeout``. ``httpx.Timeout`` only has per-phase fields, so
    callers carry the deadline in its ``read`` phase -- where
    ``httpx.Timeout(deadline)`` and ``httpx.Timeout(deadline, connect=...)``
    put it -- and the ``connect``, ``write`` and ``pool`` phases are ignored.
    """
    timeout = extensions.get("timeout")
    if not isinstance(timeout, dict):
        return None
    return timeout.get("read")


def with_request_deadline(extensions: Mapping[str, Any]) -> Dict[str, Any]:
    """Return ``extensions`` with the httpx timeout phases rewritten so pyqwest
    enforces exactly :func:`request_deadline`.

    pyqwest's httpx adapter has no deadline input of its own: it approximates
    one as ``read + write`` and ignores ``connect`` and ``pool``, so a plain
    ``httpx.Timeout(60)`` would be enforced at 120 s. Putting the whole budget
    on ``read`` and nothing on ``write`` makes that sum the deadline.
    """
    timeout = extensions.get("timeout")
    if not isinstance(timeout, dict):
        return dict(extensions)
    deadline = timeout.get("read")
    return {
        **extensions,
        "timeout": {
            **timeout,
            "read": deadline,
            "write": None if deadline is None else 0,
        },
    }


class PyqwestDeadlineTransport(PyqwestTransport):
    """:class:`PyqwestTransport` that enforces the SDK's whole-request deadline
    (see :func:`with_request_deadline`) instead of pyqwest's phase sum."""

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        request.extensions = with_request_deadline(request.extensions)
        return super().handle_request(request)


class AsyncPyqwestDeadlineTransport(AsyncPyqwestTransport):
    """Async twin of :class:`PyqwestDeadlineTransport`."""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        request.extensions = with_request_deadline(request.extensions)
        return await super().handle_async_request(request)
