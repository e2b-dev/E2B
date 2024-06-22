import json

from importlib.metadata import version

from e2b.connection_config import ConnectionConfig
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException, SandboxException


pydantic_version = version("pydantic")
if pydantic_version < "2.0.0":
    import e2b.api.v1.client as client
    import e2b.api.v1.client.models as models
    import e2b.api.v1.client.exceptions as exceptions
else:
    import e2b.api.v2.client as client
    import e2b.api.v2.client.models as models
    import e2b.api.v2.client.exceptions as exceptions


def handle_api_exception(e: exceptions.ApiException):
    body = json.loads(e.body) if e.body else {}
    if "message" in body:
        return SandboxException(f"{e.status}: {body['message']}")
    return SandboxException(f"{e.status}: {e.body}")


class ApiClient(client.ApiClient):
    def __init__(
        self,
        config: ConnectionConfig,
        require_api_key: bool = True,
        require_access_token: bool = False,
        *args,
        **kwargs,
    ):
        if require_api_key and config.api_key is None:
            raise AuthenticationException(
                "API key is required, please visit https://e2b.dev/docs to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the sandbox like Sandbox(api_key="e2b_...")',
            )

        if require_access_token and config.access_token is None:
            raise AuthenticationException(
                "Access token is required, please visit https://e2b.dev/docs to get your access token. "
                "You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `access_token` in options.",
            )

        # Defining the host is optional and defaults to https://api.e2b.dev
        # See configuration.py for a list of all supported configuration parameters.
        configuration = client.Configuration(host=config.api_url)

        if config.api_key:
            configuration.api_key["ApiKeyAuth"] = config.api_key
        if config.access_token:
            configuration.access_token = config.access_token

        super().__init__(configuration, *args, **kwargs)
        self.default_headers = default_headers


__all__ = ["ApiClient", "client", "models", "exceptions"]
