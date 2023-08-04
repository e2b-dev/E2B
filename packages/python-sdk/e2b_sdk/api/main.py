import client

from e2b_sdk.constants import SESSION_DOMAIN

# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
configuration = client.Configuration(
    host=f"https://{SESSION_DOMAIN}",
)
