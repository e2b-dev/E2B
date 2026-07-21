import re
from typing import Any

import httpx


_SAFE_RETRY_METHODS = frozenset({"GET", "HEAD"})
_REQUEST_BODY_ARGUMENTS = frozenset({"content", "data", "files", "json"})
_ERROR_CODE = re.compile(r"\berror_code\s*:\s*(\d+)(?=[,\s>]|$)")


def _is_graceful_goaway(exc: httpx.RemoteProtocolError) -> bool:
    message = str(exc)
    if "ConnectionTerminated" not in message:
        return False

    error_code = _ERROR_CODE.search(message)
    return error_code is not None and int(error_code.group(1)) == 0


class RetryingClient(httpx.Client):
    def request(
        self,
        method: str,
        url: httpx.URL | str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            return super().request(method, url, **kwargs)
        except httpx.RemoteProtocolError as exc:
            if (
                method.upper() not in _SAFE_RETRY_METHODS
                or _REQUEST_BODY_ARGUMENTS.intersection(kwargs)
                or not _is_graceful_goaway(exc)
            ):
                raise

        return super().request(method, url, **kwargs)


class AsyncRetryingClient(httpx.AsyncClient):
    async def request(
        self,
        method: str,
        url: httpx.URL | str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            return await super().request(method, url, **kwargs)
        except httpx.RemoteProtocolError as exc:
            if (
                method.upper() not in _SAFE_RETRY_METHODS
                or _REQUEST_BODY_ARGUMENTS.intersection(kwargs)
                or not _is_graceful_goaway(exc)
            ):
                raise

        return await super().request(method, url, **kwargs)
