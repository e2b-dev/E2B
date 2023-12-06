import os

SANDBOX_REFRESH_PERIOD = 5  # seconds

TIMEOUT = 60

DOMAIN = os.getenv("E2B_DOMAIN") or "e2b.dev"
SECURE = os.getenv("E2B_SECURE", "TRUE").upper() == "TRUE"
DEBUG = os.getenv("E2B_DEBUG") or False

API_DOMAIN = "localhost:3000" if DEBUG else f"api.{DOMAIN}"
PROTOCOL = "https" if SECURE and not DEBUG else "http"
API_HOST = f"{PROTOCOL}://{API_DOMAIN}"


SANDBOX_DOMAIN = DOMAIN

ENVD_PORT = 49982
WS_ROUTE = "/ws"
FILE_ROUTE = "/file"
