import inspect
import logging
from types import SimpleNamespace

from envd_frame_server import frame_recording_server, make_sync_client
from local_api_server import API_KEY, create_sandbox_reply, local_api_server

from e2b import AsyncSandbox, ConnectionConfig, Sandbox
from e2b.envd.interceptors import LoggingInterceptor
from e2b.envd.process.process_pb import ConnectRequest
from e2b.api import (
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


def _log_lines(caplog):
    return [(r.levelno, r.getMessage()) for r in caplog.records]


def _sdk_http_log_lines(caplog):
    # The SDK's own request/response lines; httpx and pyqwest log separately
    # ("HTTP Request: ..." and the `pyqwest*` loggers) regardless of `logger`.
    return [
        line
        for line in _log_lines(caplog)
        if line[1].startswith(("Request ", "Request: ", "Response ", "Response: "))
    ]


def test_api_requests_are_logged_to_the_configured_logger(caplog):
    with local_api_server(create_sandbox_reply) as server:
        with caplog.at_level(logging.DEBUG, logger="test.api-client"):
            Sandbox.create(
                api_key=API_KEY,
                api_url=server.url,
                logger=logging.getLogger("test.api-client"),
            )

    lines = _log_lines(caplog)
    assert (logging.INFO, f"Request POST {server.url}/v2/sandboxes") in lines
    assert (logging.INFO, "Response 201") in lines


async def test_async_api_requests_are_logged_to_the_configured_logger(caplog):
    with local_api_server(create_sandbox_reply) as server:
        with caplog.at_level(logging.DEBUG, logger="test.api-client.async"):
            await AsyncSandbox.create(
                api_key=API_KEY,
                api_url=server.url,
                logger=logging.getLogger("test.api-client.async"),
            )

    lines = _log_lines(caplog)
    assert (logging.INFO, f"Request POST {server.url}/v2/sandboxes") in lines
    assert (logging.INFO, "Response 201") in lines


def test_api_requests_are_not_logged_without_a_logger(caplog):
    # With no logger supplied, nothing should be logged (matching the JS SDK,
    # which only attaches its logging middleware when a logger is given).
    with local_api_server(create_sandbox_reply) as server:
        with caplog.at_level(logging.DEBUG):
            Sandbox.create(api_key=API_KEY, api_url=server.url)

    assert len(server.requests) == 1
    assert _sdk_http_log_lines(caplog) == []


async def test_async_api_requests_are_not_logged_without_a_logger(caplog):
    with local_api_server(create_sandbox_reply) as server:
        with caplog.at_level(logging.DEBUG):
            await AsyncSandbox.create(api_key=API_KEY, api_url=server.url)

    assert len(server.requests) == 1
    assert _sdk_http_log_lines(caplog) == []


def test_rpc_calls_are_not_logged_without_a_logger(caplog):
    # With no logger supplied, RPCs are not logged (matching the JS SDK,
    # which only attaches its logging middleware when a logger is given).
    with frame_recording_server(server_ends_stream=True) as server:
        with caplog.at_level(logging.DEBUG):
            events = list(make_sync_client(server.port).connect(ConnectRequest()))

    assert len(events) == 1
    assert _sdk_http_log_lines(caplog) == []


def test_rpc_calls_are_logged_to_the_configured_logger(caplog):
    custom = logging.getLogger("test.rpc.config")
    with frame_recording_server(server_ends_stream=True) as server:
        with caplog.at_level(logging.DEBUG, logger="test.rpc.config"):
            client = make_sync_client(server.port, logger=custom)
            events = list(client.connect(ConnectRequest()))

    assert len(events) == 1
    lines = [
        (r.levelno, r.getMessage())
        for r in caplog.records
        if r.name == "test.rpc.config"
    ]
    url = f"http://127.0.0.1:{server.port}/process.Process/Connect"
    assert (logging.INFO, f"Request: POST {url}") in lines
    assert (logging.INFO, f"Response: ok {url}") in lines


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


def test_sync_logging_event_hooks_emit_records(caplog):
    log = logging.getLogger("test.hooks.sync")
    hooks = make_logging_event_hooks(log)

    class _Req:
        method = "GET"
        url = "https://example.com/foo"

    class _Resp:
        def __init__(self, status_code):
            self.status_code = status_code

    with caplog.at_level(logging.DEBUG, logger="test.hooks.sync"):
        hooks["request"][0](_Req())
        hooks["response"][0](_Resp(200))
        hooks["response"][0](_Resp(500))

    levels = [(r.levelno, r.getMessage()) for r in caplog.records]
    assert (logging.INFO, "Request GET https://example.com/foo") in levels
    assert (logging.INFO, "Response 200") in levels
    assert (logging.ERROR, "Response 500") in levels


async def test_async_logging_event_hooks_emit_records(caplog):
    log = logging.getLogger("test.hooks.async")
    hooks = make_async_logging_event_hooks(log)

    class _Req:
        method = "GET"
        url = "https://example.com/foo"

    class _Resp:
        def __init__(self, status_code):
            self.status_code = status_code

    with caplog.at_level(logging.DEBUG, logger="test.hooks.async"):
        await hooks["request"][0](_Req())
        await hooks["response"][0](_Resp(200))
        await hooks["response"][0](_Resp(500))

    levels = [(r.levelno, r.getMessage()) for r in caplog.records]
    assert (logging.INFO, "Request GET https://example.com/foo") in levels
    assert (logging.INFO, "Response 200") in levels
    assert (logging.ERROR, "Response 500") in levels
