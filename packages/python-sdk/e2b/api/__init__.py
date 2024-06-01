from importlib.metadata import version

from e2b.connection_config import ConnectionConfig
from e2b.api.metadata import default_headers


pydantic_version = version("pydantic")
if pydantic_version < "2.0.0":
    import e2b.api.v1.client as client
    import e2b.api.v1.client.models as models
    import e2b.api.v1.client.exceptions as exceptions
else:
    import e2b.api.v2.client as client
    import e2b.api.v2.client.models as models
    import e2b.api.v2.client.exceptions as exceptions


class E2BApiClient(client.ApiClient):
    def __init__(
        self,
        config: ConnectionConfig,
        *args,
        **kwargs,
    ):
        # Defining the host is optional and defaults to https://api.e2b.dev
        # See configuration.py for a list of all supported configuration parameters.
        configuration = client.Configuration(host=config.api_url)

        configuration.api_key["ApiKeyAuth"] = config.api_key
        configuration.access_token = config.access_token

        super().__init__(configuration, *args, **kwargs)
        self.default_headers = default_headers


__all__ = ["E2BApiClient", "client", "models"]
