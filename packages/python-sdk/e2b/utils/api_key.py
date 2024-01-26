from os import getenv
from typing import Optional

from e2b.sandbox.exception import AuthenticationException


def get_api_key(api_key: Optional[str]) -> str:
    api_key = api_key or getenv("E2B_API_KEY")

    if api_key is None:
        raise AuthenticationException(
            "API key is required, please visit https://e2b.dev/docs to get your API key. "
            "You can either set the environment variable `E2B_API_KEY` "
            'or you can pass it directly to the sandbox like Sandbox(api_key="e2b_...")',
        )

    return api_key
