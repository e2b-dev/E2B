from importlib.metadata import version


pydantic_version = version("pydantic")
if pydantic_version < "2.0.0":
    import e2b.envd.v1.client as client
    import e2b.envd.v1.client.models as models
    import e2b.envd.v1.client.exceptions as exceptions
else:
    import e2b.envd.v2.client as client
    import e2b.envd.v2.client.models as models
    import e2b.envd.v2.client.exceptions as exceptions


class EnvdApiClient(client.ApiClient):
    def __init__(
        self,
        api_url: str,
        *args,
        **kwargs,
    ):
        # See configuration.py for a list of all supported configuration parameters.
        configuration = client.Configuration(host=api_url)

        super().__init__(configuration, *args, **kwargs)


__all__ = ["EnvdApiClient", "client", "models"]
