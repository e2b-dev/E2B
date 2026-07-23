"""
Server streams closed before the server ends them must send an HTTP/2
``RST_STREAM`` (CANCEL) so the server tears the stream down.

httpcore itself never cancels a stream on early response close — it only
stops reading it. On the shared envd connection an abandoned stream then
stays attached server-side and blocks envd's process output fan-out for
every other consumer once its flow-control window fills (#1352, #1587).
"""

import json
import struct

import hpack
import httpcore
import hyperframe.frame
from httpcore._backends.mock import (
    AsyncMockBackend,
    AsyncMockStream,
    MockBackend,
    MockStream,
)

from e2b.envd.process import process_pb2
from e2b_connect.client import Client, EnvelopeFlags, encode_envelope

URL = "https://mock.e2b.test/process.Process/Connect"
RST_STREAM_FRAME_TYPE = 0x3
H2_CANCEL = 0x8


class CapturingMockStream(MockStream):
    def __init__(self, buffer, http2, writes):
        super().__init__(buffer, http2=http2)
        self._writes = writes

    def write(self, buffer, timeout=None):
        self._writes.append(bytes(buffer))


class CapturingMockBackend(MockBackend):
    def __init__(self, buffer, http2, writes):
        super().__init__(buffer, http2=http2)
        self._writes = writes

    def connect_tcp(self, *args, **kwargs):
        return CapturingMockStream(list(self._buffer), self._http2, self._writes)


class CapturingAsyncMockStream(AsyncMockStream):
    def __init__(self, buffer, http2, writes):
        super().__init__(buffer, http2=http2)
        self._writes = writes

    async def write(self, buffer, timeout=None):
        self._writes.append(bytes(buffer))


class CapturingAsyncMockBackend(AsyncMockBackend):
    def __init__(self, buffer, http2, writes):
        super().__init__(buffer, http2=http2)
        self._writes = writes

    async def connect_tcp(self, *args, **kwargs):
        return CapturingAsyncMockStream(list(self._buffer), self._http2, self._writes)


def connect_response_envelope() -> bytes:
    return encode_envelope(
        flags=EnvelopeFlags(0),
        data=json.dumps({"event": {"data": {"stdout": "aGk="}}}).encode(),
    )


def end_stream_envelope() -> bytes:
    return encode_envelope(flags=EnvelopeFlags.end_stream, data=b"{}")


def server_frames(server_ends_stream: bool) -> list:
    encoder = hpack.Encoder()
    frames = [
        hyperframe.frame.SettingsFrame(),
        hyperframe.frame.HeadersFrame(
            stream_id=1,
            data=encoder.encode(
                [
                    (b":status", b"200"),
                    (b"content-type", b"application/connect+json"),
                ]
            ),
            flags=["END_HEADERS"],
        ),
        hyperframe.frame.DataFrame(stream_id=1, data=connect_response_envelope()),
    ]
    if server_ends_stream:
        frames.append(
            hyperframe.frame.DataFrame(
                stream_id=1,
                data=end_stream_envelope(),
                flags=["END_STREAM"],
            )
        )
    return [frame.serialize() for frame in frames]


def rst_stream_frames(writes: list) -> list:
    """Parse captured outgoing bytes into (stream_id, error_code) RST frames."""
    data = b"".join(writes)
    # Skip the HTTP/2 client connection preface.
    preface = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
    if data.startswith(preface):
        data = data[len(preface) :]
    found = []
    while len(data) >= 9:
        length = int.from_bytes(data[0:3], "big")
        frame_type = data[3]
        stream_id = int.from_bytes(data[5:9], "big") & 0x7FFFFFFF
        payload = data[9 : 9 + length]
        if frame_type == RST_STREAM_FRAME_TYPE:
            (error_code,) = struct.unpack(">I", payload)
            found.append((stream_id, error_code))
        data = data[9 + length :]
    return found


def make_client(pool=None, async_pool=None) -> Client:
    return Client(
        pool=pool,
        async_pool=async_pool,
        url=URL,
        response_type=process_pb2.ConnectResponse,
        json=True,
    )


async def test_async_early_close_sends_rst_stream():
    writes = []
    backend = CapturingAsyncMockBackend(
        server_frames(server_ends_stream=False), http2=True, writes=writes
    )
    async with httpcore.AsyncConnectionPool(
        network_backend=backend, http2=True
    ) as pool:
        client = make_client(async_pool=pool)
        events = client.acall_server_stream(process_pb2.ConnectRequest())
        event = await events.__anext__()
        assert event.event.data.stdout == b"hi"

        assert rst_stream_frames(writes) == []
        await events.aclose()
        assert rst_stream_frames(writes) == [(1, H2_CANCEL)]


async def test_async_completed_stream_does_not_send_rst_stream():
    writes = []
    backend = CapturingAsyncMockBackend(
        server_frames(server_ends_stream=True), http2=True, writes=writes
    )
    async with httpcore.AsyncConnectionPool(
        network_backend=backend, http2=True
    ) as pool:
        client = make_client(async_pool=pool)
        events = [
            event
            async for event in client.acall_server_stream(process_pb2.ConnectRequest())
        ]
        assert len(events) == 1
        assert rst_stream_frames(writes) == []


def test_sync_early_close_sends_rst_stream():
    writes = []
    backend = CapturingMockBackend(
        server_frames(server_ends_stream=False), http2=True, writes=writes
    )
    with httpcore.ConnectionPool(network_backend=backend, http2=True) as pool:
        client = make_client(pool=pool)
        events = client.call_server_stream(process_pb2.ConnectRequest())
        event = next(events)
        assert event.event.data.stdout == b"hi"

        assert rst_stream_frames(writes) == []
        events.close()
        assert rst_stream_frames(writes) == [(1, H2_CANCEL)]


def test_sync_completed_stream_does_not_send_rst_stream():
    writes = []
    backend = CapturingMockBackend(
        server_frames(server_ends_stream=True), http2=True, writes=writes
    )
    with httpcore.ConnectionPool(network_backend=backend, http2=True) as pool:
        client = make_client(pool=pool)
        events = list(client.call_server_stream(process_pb2.ConnectRequest()))
        assert len(events) == 1
        assert rst_stream_frames(writes) == []
