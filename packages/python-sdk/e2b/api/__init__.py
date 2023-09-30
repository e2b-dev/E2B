from importlib.metadata import version

pydantic_version = version("pydantic")
if pydantic_version < "2.0.0":
    import e2b.api.v1.client as client
    import e2b.api.v1.client.models as models
    import e2b.api.v1.client.exceptions as exceptions
else:
    import e2b.api.v2.client as client
    import e2b.api.v2.client.models as models
    import e2b.api.v2.client.exceptions as exceptions

from e2b.constants import SESSION_DOMAIN

# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
configuration = client.Configuration(
    host=f"https://{SESSION_DOMAIN}",
)

__all__ = ["configuration", "client", "models"]
