"""Reset the SDK's process-global pyqwest transport caches.

Every persistent HTTP stack in the SDK — control-plane REST, envd HTTP API,
envd RPC, volume content — draws its connection pool from
``e2b.api.client_sync``/``client_async``, so one helper clears them all
(template uploads deliberately build their own non-retrying transport inline
and are not cached here). Tests
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
