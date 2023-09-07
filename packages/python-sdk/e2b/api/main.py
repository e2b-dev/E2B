import e2b.api.client as client

from e2b.constants import API_DOMAIN


# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
def get_configuration(api_key: str):
    return client.Configuration(
        host=f"https://{API_DOMAIN}",
        access_token=api_key,
        api_key={
            "ApiKeyAuth": api_key,
        },
    )
