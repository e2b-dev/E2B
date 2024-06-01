import os

from typing import Optional
from e2b.sandbox.exceptions import AuthenticationException


DOMAIN = os.getenv("E2B_DOMAIN", "e2b.dev")
DEBUG = os.getenv("E2B_DEBUG", "false") == "true"
API_KEY = os.getenv("E2B_API_KEY")
ACCESS_TOKEN = os.getenv("E2B_ACCESS_TOKEN")


class ConnectionConfig:
    @property
    def api_key(self):
        if self._api_key is None:
            raise AuthenticationException(
                "API key is required, please visit https://e2b.dev/docs to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the sandbox like Sandbox(api_key="e2b_...")',
            )

        return self._api_key

    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
    ):
        self.domain = domain or DOMAIN
        self.debug = debug or DEBUG
        self._api_key = api_key or API_KEY
        self.access_token = access_token or ACCESS_TOKEN

        self.api_url = "http://localhost:3000" if debug else f"https://api.{domain}"
