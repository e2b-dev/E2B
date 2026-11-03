import pytest

import e2b.api.client_async as client_async
import e2b.api.client_sync as client_sync


@pytest.mark.parametrize(
    "module,pool_class",
    [(client_sync, "SyncHTTPTransport"), (client_async, "HTTPTransport")],
)
@pytest.mark.parametrize("http_version,cap", [("1.1", 7), ("2", 3)])
def test_pool_cap_depends_on_http_version(
    monkeypatch, module, pool_class, http_version, cap
):
    captured = {}

    def fake_transport(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(module, pool_class, fake_transport)
    monkeypatch.setattr(module, "max_connections", 3)
    monkeypatch.setattr(module, "max_http1_connections", 7)
    monkeypatch.setattr(module, "_transports", {})
    monkeypatch.setattr(module, "_pools", {})

    module.get_pyqwest_transport(None, http_version=http_version)

    assert captured["max_connections_per_address"] == cap
