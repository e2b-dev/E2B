import inspect
import logging
import asyncio
from types import SimpleNamespace

from e2b import AsyncSandbox, ConnectionConfig, Sandbox
from e2b.envd.interceptors import LoggingInterceptor, build_interceptors
from e2b.api import (
    ApiClient,
    handle_api_exception,
    make_async_logging_event_hooks,
    make_logging_event_hooks,
)
from e2b.connection_config import ApiParams
from e2b.volume.connection_config import VolumeConnectionConfig


def test_connection_config_stores_logger():
    custom = logging.getLogger("test.custom")
    config = ConnectionConfig(api_key="e2b_" + "0" * 40, logger=custom)
    assert config.logger is custom


def test_connection_config_logger_defaults_to_none():
    config = ConnectionConfig(api_key="e2b_" + "0" * 40)
    assert config.logger is None


def test_logger_is_not_a_public_per_request_api_param():
    # Matching the JS SDK, `logger` is a construction-time option (Sandbox.create
    # / connect), not a public per-request ApiParams field that control-plane
    # methods like kill/list/get_info accept from the caller.
    assert "logger" not in ApiParams.__annotations__


def test_get_api_params_propagates_stored_logger():
    # Instance control-plane methods (kill, pause, set_timeout, get_info,
    # connect) rebuild a throwaway ConnectionConfig from these params, so the
    # logger the sandbox was created/connected with must survive the round-trip.
    custom = logging.getLogger("test.propagate")
    config = ConnectionConfig(api_key="e2b_" + "0" * 40, logger=custom)
    assert config.get_api_params()["logger"] is custom
    assert ConnectionConfig(**config.get_api_params()).logger is custom

    no_logger = ConnectionConfig(api_key="e2b_" + "0" * 40)
    assert no_logger.get_api_params()["logger"] is None


def test_logger_is_accepted_on_create_and_connect():
    for cls in (Sandbox, AsyncSandbox):
        assert "logger" in inspect.signature(cls.create).parameters
    # `logger` is a construction option, so it is accepted by the static
    # `Sandbox.connect(sandbox_id, ...)` form (which builds a fresh instance)
    # but not by instance `sandbox.connect()`, where the already-built clients
    # cannot adopt a new logger.
    assert "logger" not in inspect.signature(Sandbox.connect).parameters
    assert "logger" not in inspect.signature(AsyncSandbox.connect).parameters


def test_volume_connection_config_stores_and_round_trips_logger():
    custom = logging.getLogger("test.volume")
    config = VolumeConnectionConfig(token="token", logger=custom)
    assert config.logger is custom
    assert config.get_api_params()["logger"] is custom


def test_api_client_uses_config_logger():
    custom = logging.getLogger("test.api-client")
    config = ConnectionConfig(api_key="e2b_" + "0" * 40, logger=custom)
    client = ApiClient(config)
    try:
        assert client._logger is custom
    finally:
        client.get_httpx_client().close()


def test_api_client_without_logger_emits_no_hooks():
    # With no logger supplied, nothing should be logged (matching the JS SDK,
    # which only attaches its logging middleware when a logger is given).
    config = ConnectionConfig(api_key="e2b_" + "0" * 40)
    client = ApiClient(config)
    try:
        assert client._logger is None
        assert client.get_httpx_client().event_hooks == {
            "request": [],
            "response": [],
        }
    finally:
        client.get_httpx_client().close()


def test_rpc_client_without_logger_has_no_logging_interceptor(test_api_key):
    # With no logger supplied, no logging interceptor is attached to RPC
    # clients (matching the JS SDK, which only attaches its logging
    # middleware when a logger is given).
    config = ConnectionConfig(api_key=test_api_key)
    interceptors = build_interceptors(config, "https://example.com")
    assert not any(isinstance(i, LoggingInterceptor) for i in interceptors)


def test_rpc_clients_get_logging_interceptor_from_config(test_api_key):
    custom = logging.getLogger("test.rpc")
    config = ConnectionConfig(api_key=test_api_key, logger=custom)
    interceptors = build_interceptors(config, "https://example.com")
    logging_interceptors = [
        i for i in interceptors if isinstance(i, LoggingInterceptor)
    ]
    assert len(logging_interceptors) == 1
    assert logging_interceptors[0]._logger is custom


def _fake_ctx():
    return SimpleNamespace(
        method=SimpleNamespace(service_name="process.Process", name="List")
    )


def test_logging_interceptor_logs_unary_rpc(caplog):
    custom = logging.getLogger("test.rpc")
    interceptor = LoggingInterceptor(custom, "https://example.com")
    ctx = _fake_ctx()

    with caplog.at_level(logging.DEBUG, logger="test.rpc"):
        result = interceptor.intercept_unary_sync(
            lambda request, ctx: "response", "request", ctx
        )
        assert result == "response"

        def fail(request, ctx):
            raise RuntimeError("boom")

        try:
            interceptor.intercept_unary_sync(fail, "request", ctx)
        except RuntimeError:
            pass

    levels = [(r.levelno, r.getMessage()) for r in caplog.records]
    url = "https://example.com/process.Process/List"
    assert (logging.INFO, f"Request: POST {url}") in levels
    assert (logging.INFO, f"Response: ok {url}") in levels
    assert (logging.ERROR, f"Response: boom {url}") in levels


def test_logging_interceptor_logs_stream_messages(caplog):
    custom = logging.getLogger("test.rpc")
    interceptor = LoggingInterceptor(custom, "https://example.com")
    ctx = _fake_ctx()

    with caplog.at_level(logging.DEBUG, logger="test.rpc"):
        messages = list(
            interceptor.intercept_server_stream_sync(
                lambda request, ctx: iter(["a", "b"]), "request", ctx
            )
        )
        assert messages == ["a", "b"]

    levels = [(r.levelno, r.getMessage()) for r in caplog.records]
    url = "https://example.com/process.Process/List"
    assert (logging.INFO, f"Request: POST {url}") in levels
    assert levels.count((logging.DEBUG, f"Response stream: {url}")) == 2
    assert (logging.INFO, f"Response: ok {url}") in levels


def test_logging_event_hooks_without_logger_are_empty():
    assert make_logging_event_hooks(None) == {}
    assert make_async_logging_event_hooks(None) == {}


def test_sync_logging_event_hooks_emit_records(caplog, monkeypatch):
    monkeypatch.delenv("E2B_USER_AGENT_SOURCE", raising=False)
    log = logging.getLogger("test.hooks.sync")
    hooks = make_logging_event_hooks(log)

    class _Req:
        method = "GET"
        url = "https://example.com/foo"

    class _Resp:
        def __init__(self, status_code, headers=None):
            self.status_code = status_code
            self.headers = headers or {}

    with caplog.at_level(logging.DEBUG, logger="test.hooks.sync"):
        hooks["request"][0](_Req())
        hooks["response"][0](_Resp(200))
        hooks["response"][0](_Resp(500, {"X-E2B-Trace-ID": "trace-123"}))

    levels = [(r.levelno, r.getMessage()) for r in caplog.records]
    assert (logging.INFO, "Request GET https://example.com/foo") in levels
    assert (logging.INFO, "Response 200") in levels
    assert (logging.ERROR, "Response 500") in levels


def test_make_async_logging_event_hooks_shape():
    hooks = make_async_logging_event_hooks(logging.getLogger("test.hooks.async"))
    assert set(hooks) == {"request", "response"}
    assert len(hooks["request"]) == 1
    assert len(hooks["response"]) == 1


def test_async_logging_event_hooks_log_trace_id_for_ci_failure(caplog, monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")
    log = logging.getLogger("test.hooks.async")
    hooks = make_async_logging_event_hooks(log, include_diagnostics=True)
    response = SimpleNamespace(
        status_code=500,
        headers={"X-E2B-Trace-ID": "trace-123"},
    )

    with caplog.at_level(logging.ERROR, logger="test.hooks.async"):
        asyncio.run(hooks["response"][0](response))

    assert (logging.ERROR, "Response 500 trace_id=trace-123") in [
        (record.levelno, record.getMessage()) for record in caplog.records
    ]


def test_api_client_diagnostics_follow_captured_request_source(caplog, monkeypatch):
    api_key = "e2b_" + "0" * 40
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")
    ci_client = ApiClient(ConnectionConfig(api_key=api_key))
    monkeypatch.delenv("E2B_USER_AGENT_SOURCE")
    normal_client = ApiClient(ConnectionConfig(api_key=api_key))
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")

    response = SimpleNamespace(
        status_code=500,
        headers={"X-E2B-Trace-ID": "trace-123"},
    )
    with caplog.at_level(logging.ERROR, logger="e2b.ci"):
        ci_client._logging_event_hooks()["response"][0](response)

    assert (logging.ERROR, "Response 500 trace_id=trace-123") in [
        (record.levelno, record.getMessage()) for record in caplog.records
    ]
    assert normal_client._logging_event_hooks() == {}


def test_ci_api_exception_keeps_public_message(monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")
    response = SimpleNamespace(
        status_code=500,
        content=b'{"message":"Internal error"}',
        headers={"X-E2B-Trace-ID": "trace-123"},
    )

    error = handle_api_exception(response)

    assert str(error) == "500: Internal error"


def test_api_exception_does_not_include_trace_id_outside_ci(monkeypatch):
    monkeypatch.delenv("E2B_USER_AGENT_SOURCE", raising=False)
    response = SimpleNamespace(
        status_code=500,
        content=b'{"message":"Internal error"}',
        headers={"X-E2B-Trace-ID": "trace-123"},
    )

    error = handle_api_exception(response)

    assert str(error) == "500: Internal error"
