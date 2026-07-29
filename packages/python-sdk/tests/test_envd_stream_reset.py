"""
Server streams closed before the server ends them must cancel the HTTP/2
stream (``RST_STREAM`` CANCEL) so envd tears the stream down server-side.

A stream that is merely abandoned stays attached to envd's process output
fan-out and, once its flow-control window fills, blocks output delivery for
every other consumer of the same process on the shared connection (#1352,
#1587). The previous httpcore-based transport had exactly that bug; on this
stack the cancellation comes from pyqwest (hyper), and these tests pin the
behavior at the frame level: a real plaintext HTTP/2 server records the
frames the client sends (see ``envd_frame_server``), and the client is the
actual generated stub wired with the SDK's codec and interceptors, as built
by the ``e2b.envd.client_sync``/``client_async`` factories.
"""

import logging

import pytest
from envd_frame_server import (
    assert_stdout_event,
    frame_recording_server,
    make_async_client,
    make_sync_client,
)

from e2b.envd.client_async import first_event
from e2b.exceptions import TimeoutException
from e2b.envd.process.process_pb import ConnectRequest


def test_sync_early_close_sends_rst_stream():
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_sync_client(server.port).connect(ConnectRequest())
        assert_stdout_event(next(events))
        assert server.resets == []
        events.close()  # what CommandHandle.disconnect() does
        server.assert_reset_sent()


def test_sync_completed_stream_does_not_send_rst_stream():
    with frame_recording_server(server_ends_stream=True) as server:
        events = list(make_sync_client(server.port).connect(ConnectRequest()))
        assert len(events) == 1
        server.assert_no_reset_sent()


def test_sync_early_close_propagates_through_logging_interceptor():
    # The logging interceptor wraps the stream in another generator; closing
    # the outer one must still cancel the underlying HTTP/2 stream.
    with frame_recording_server(server_ends_stream=False) as server:
        client = make_sync_client(server.port, logger=logging.getLogger("test.reset"))
        events = client.connect(ConnectRequest())
        assert_stdout_event(next(events))
        events.close()
        server.assert_reset_sent()


def test_sync_abandoned_stream_sends_rst_stream():
    # No close() at all — dropping the last reference must still cancel the
    # stream (refcount finalization closes the generator chain).
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_sync_client(server.port).connect(ConnectRequest())
        assert_stdout_event(next(events))
        del events
        server.assert_reset_sent()


async def test_async_early_close_sends_rst_stream():
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_async_client(server.port).connect(ConnectRequest())
        assert_stdout_event(await events.__anext__())
        assert server.resets == []
        await events.aclose()  # what AsyncCommandHandle.disconnect() does
        server.assert_reset_sent()


async def test_async_completed_stream_does_not_send_rst_stream():
    with frame_recording_server(server_ends_stream=True) as server:
        events = [
            event
            async for event in make_async_client(server.port).connect(ConnectRequest())
        ]
        assert len(events) == 1
        server.assert_no_reset_sent()


async def test_async_early_close_propagates_through_logging_interceptor():
    with frame_recording_server(server_ends_stream=False) as server:
        client = make_async_client(server.port, logger=logging.getLogger("test.reset"))
        events = client.connect(ConnectRequest())
        assert_stdout_event(await events.__anext__())
        await events.aclose()
        server.assert_reset_sent()


async def test_async_setup_timeout_sends_rst_stream():
    # `request_timeout` expiring while envd never answers (see
    # test_envd_stream_request_timeout) must tear the HTTP/2 stream down,
    # not leave it attached to the shared connection.
    with frame_recording_server(server_ends_stream=False, respond=False) as server:
        events = make_async_client(server.port).connect(ConnectRequest())
        with pytest.raises(TimeoutException, match="request_timeout"):
            await first_event(events, 0.3)
        await events.aclose()  # what the call sites do next; must be a no-op
        server.assert_reset_sent()
