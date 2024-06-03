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
        self.request_timeout = (
            request_timeout if request_timeout is not None else REQUEST_TIMEOUT
        )

        self.api_url = "http://localhost:3000" if debug else f"https://api.{domain}"


Username = Literal["root", "user"]
