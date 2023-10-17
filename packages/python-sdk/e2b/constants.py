import os

INSTANCE_REFRESH_PERIOD = 5  # seconds

TIMEOUT = 60

API_DOMAIN = "api.e2b.dev"
API_HOST = "http://localhost:3000" if os.getenv("DEBUG") else f"https://{API_DOMAIN}"

INSTANCE_DOMAIN = "e2b.dev"

ENVD_PORT = 49982
WS_ROUTE = "/ws"
FILE_ROUTE = "/file"
