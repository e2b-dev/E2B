import os

from typing import Dict, Optional, TypedDict

from httpx._types import ProxyTypes
from typing_extensions import Unpack

from e2b.api.metadata import package_version

REQUEST_TIMEOUT: float = 60.0  # 60 seconds


class VolumeApiParams(TypedDict, total=False):
    """
    Parameters for requests made to the volume content API.
    """

    request_timeout: Optional[float]
    """Timeout for the request in **seconds**, defaults to 60 seconds."""

    headers: Optional[Dict[str, str]]
    """Additional headers to send with the request."""

    token: Optional[str]
    """Volume auth token used for `Authorization: Bearer <token>`."""

    api_url: Optional[str]
    """URL to use for the volume API, defaults to `E2B_VOLUME_API_URL` or `https://volumecontent.e2b.app`."""

    proxy: Optional[ProxyTypes]
    """Proxy to use for the request."""


class VolumeConnectionConfig:
    """
    Configuration for the volume content API.

    Uses bearer token authentication and defaults to the volume content host.
    """

    @staticmethod
    def _volume_api_url():
        return os.getenv("E2B_VOLUME_API_URL")

    @staticmethod
    def _access_token():
        return os.getenv("E2B_ACCESS_TOKEN")

    @staticmethod
    def _get_request_timeout(
        default_timeout: Optional[float],
        request_timeout: Optional[float],
    ):
        if request_timeout == 0:
            return None
        elif request_timeout is not None:
            return request_timeout
        else:
            return default_timeout

    def __init__(
        self,
        token: Optional[str] = None,
        api_url: Optional[str] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ):
        self.api_url = (
            api_url or self._volume_api_url() or "https://volumecontent.e2b.app"
        )
        self.access_token = token or self._access_token()
        self.token = self.access_token
        self.proxy = proxy

        self.headers = headers or {}
        self.headers["User-Agent"] = f"e2b-python-sdk/{package_version}"

        self.request_timeout = self._get_request_timeout(
            REQUEST_TIMEOUT, request_timeout
        )

    def get_request_timeout(self, request_timeout: Optional[float] = None):
        return self._get_request_timeout(self.request_timeout, request_timeout)

    def get_api_params(
        self,
        **opts: Unpack[VolumeApiParams],
    ) -> dict:
        """
        Get request parameters for the volume content API.
        """
        headers = opts.get("headers")
        request_timeout = opts.get("request_timeout")
        token = opts.get("token")
        api_url = opts.get("api_url")
        proxy = opts.get("proxy")

        req_headers = self.headers.copy()
        if headers is not None:
            req_headers.update(headers)

        return dict(
            VolumeApiParams(
                token=token if token is not None else self.token,
                api_url=api_url if api_url is not None else self.api_url,
                request_timeout=self.get_request_timeout(request_timeout),
                headers=req_headers,
                proxy=proxy if proxy is not None else self.proxy,
            )
        )
