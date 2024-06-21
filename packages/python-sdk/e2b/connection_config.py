import os

from typing import Literal, Optional

DOMAIN = os.getenv("E2B_DOMAIN", "e2b.dev")
DEBUG = os.getenv("E2B_DEBUG", "false") == "true"
API_KEY = os.getenv("E2B_API_KEY")
ACCESS_TOKEN = os.getenv("E2B_ACCESS_TOKEN")

REQUEST_TIMEOUT: float = 30  # 30s


class ConnectionConfig:
    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        request_timeout: Optional[float] = None,
    ):
        self.domain = domain or DOMAIN
        self.debug = debug or DEBUG
        self.api_key = api_key or API_KEY
        self.access_token = access_token or ACCESS_TOKEN

        self.request_timeout = ConnectionConfig._get_request_timeout(
            REQUEST_TIMEOUT,
            request_timeout,
        )

        if request_timeout == 0:
            self.request_timeout = None
        elif request_timeout is not None:
            self.request_timeout = request_timeout
        else:
            self.request_timeout = REQUEST_TIMEOUT

        self.api_url = "http://localhost:3000" if debug else f"https://api.{domain}"

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

    def get_request_timeout(self, request_timeout: Optional[float] = None):
        return self._get_request_timeout(self.request_timeout, request_timeout)


Username = Literal["root", "user"]
