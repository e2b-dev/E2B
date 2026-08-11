"""Reset the SDK's process-global pyqwest transport caches.

Every HTTP stack in the SDK — control-plane REST, envd HTTP API, envd RPC,
volume content, template uploads — draws its connection pool from
``e2b.api.client_sync``/``client_async``, so one helper clears them all. Tests
that assert on pool identity or rebuild a pool with different tuning call this
before and after. Not a test module itself — imported by the transport test
modules (``pythonpath = tests`` in pytest.ini makes it importable under
``--import-mode=importlib``).
"""

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync


def reset_transport_caches() -> None:
    for module in (api_client_sync, api_client_async):
        module._transports.clear()
        module._httpx_transports.clear()
