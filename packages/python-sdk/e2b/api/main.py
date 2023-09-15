import platform
from importlib import metadata

import e2b.api.client as client
from e2b.constants import API_DOMAIN

# Defining the host is optional and defaults to https://api.e2b.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = client.Configuration(
    host=f"https://{API_DOMAIN}",
)


class E2BApiClient(client.ApiClient):
    def __init__(self, api_key: str, *args, **kwargs):
        configuration.api_key["ApiKeyAuth"] = api_key
        super().__init__(configuration=configuration, *args, **kwargs)
        self.default_headers = {
            "package_version": metadata.version("e2b"),
            "lang": "python",
            "lang_version": platform.python_version(),
            "system": platform.system(),
            "os": platform.platform(),
            "publisher": "e2b",
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        }
