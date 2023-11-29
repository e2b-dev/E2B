import os

SANDBOX_REFRESH_PERIOD = 5  # seconds

TIMEOUT = 60

DOMAIN = os.getenv("E2B_DOMAIN") or "e2b.dev"
SECURE = os.getenv("E2B_SECURE", "TRUE").upper() == "TRUE"
DEBUG = os.getenv("E2B_DEBUG") or False
API_DOMAIN = f"api.{DOMAIN}"

if DEBUG:
    DOMAIN = "localhost"
    API_DOMAIN = "localhost"
    SECURE = False

PROTOCOL = "https" if SECURE else "http"
API_HOST = f"{PROTOCOL}://{API_DOMAIN}"


SANDBOX_DOMAIN = DOMAIN

ENVD_PORT = 49982
WS_ROUTE = "/ws"
FILE_ROUTE = "/file"
