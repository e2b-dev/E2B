import gzip
import json
import struct

from httpcore import (
    ConnectionPool,
    AsyncConnectionPool,
    RemoteProtocolError,
    Response,
)
from enum import Flag, Enum
from typing import Callable, Optional, Dict, Any, Generator, Tuple
from google.protobuf import json_format
from httpcore import URL


class EnvelopeFlags(Flag):
    compressed = 0b00000001
    end_stream = 0b00000010


class Code(Enum):
    canceled = "canceled"
    unknown = "unknown"
    invalid_argument = "invalid_argument"
    deadline_exceeded = "deadline_exceeded"
    not_found = "not_found"
    already_exists = "already_exists"
    permission_denied = "permission_denied"
    resource_exhausted = "resource_exhausted"
    failed_precondition = "failed_precondition"
    aborted = "aborted"
    out_of_range = "out_of_range"
    unimplemented = "unimplemented"
    internal = "internal"
    unavailable = "unavailable"
    data_loss = "data_loss"
    unauthenticated = "unauthenticated"


class ConnectException(Exception):
    def __init__(self, status: Code, message: str):
        self.status = status
        self.message = message


envelope_header_length = 5
envelope_header_pack = ">BI"


def encode_envelope(*, flags: EnvelopeFlags, data):
    return encode_envelope_header(flags=flags.value, data=data) + data


def encode_envelope_header(*, flags, data):
    return struct.pack(envelope_header_pack, flags, len(data))


def decode_envelope_header(header):
    flags, data_len = struct.unpack(envelope_header_pack, header)
    return EnvelopeFlags(flags), data_len


def error_for_response(http_resp: Response):
    try:
        error = json.loads(http_resp.content)
    except (json.decoder.JSONDecodeError, KeyError):
        if http_resp.status == 429:
            return ConnectException(
                Code.resource_exhausted,
                f"{http_resp.content.decode()} The requests are being rate limited.",
            )
        elif http_resp.status == 502:
            return ConnectException(
                Code.unavailable,
                http_resp.content.decode(),
            )
        else:
            return ConnectException(
                Code.unknown,
                f"{http_resp.status}: {http_resp.content.decode('utf-8')}",
            )
    else:
        return make_error(error)


def make_error(error):
    status = None
    try:
        status = Code(error["code"])
    except KeyError:
        status = Code.unknown
        pass

    return ConnectException(status, error.get("message", ""))


class GzipCompressor:
    name = "gzip"
    decompress = gzip.decompress
    compress = gzip.compress


class JSONCodec:
    content_type = "json"

    @staticmethod
    def encode(msg):
        return json_format.MessageToJson(msg).encode("utf8")

    @staticmethod
    def decode(data, *, msg_type):
        msg = msg_type()
        json_format.Parse(data.decode("utf8"), msg)
        return msg


class ProtobufCodec:
    content_type = "proto"

    @staticmethod
    def encode(msg):
        return msg.SerializeToString()

    @staticmethod
    def decode(data, *, msg_type):
        msg = msg_type()
        msg.ParseFromString(data)
        return msg


class Client:
    def __init__(
        self,
        *,
        pool: Optional[ConnectionPool] = None,
        async_pool: Optional[AsyncConnectionPool] = None,
        url: str,
        response_type,
        compressor=None,
        json: Optional[bool] = False,
        headers: Optional[Dict[str, str]] = None,
    ):
        if headers is None:
            headers = {}

        self.pool = pool
        self.async_pool = async_pool
        self.url = url
        self._codec = JSONCodec if json else ProtobufCodec
        self._response_type = response_type
        self._compressor = compressor
        self._headers = {**{"user-agent": "connect-python"}, **headers}
        self._connection_retries = 3

    def _prepare_unary_request(
        self,
        req,
        request_timeout=None,
        headers={},
        **opts,
    ):
        data = self._codec.encode(req)

        if self._compressor is not None:
            data = self._compressor.compress(data)

        extensions = (
            None
            if request_timeout is None
            else {
                "timeout": {
                    "connect": request_timeout,
                    "pool": request_timeout,
                    "read": request_timeout,
                    "write": request_timeout,
                }
            }
        )

        return {
            "method": "POST",
            "url": self.url,
            "content": data,
            "extensions": extensions,
            "headers": {
                **self._headers,
                **headers,
                **opts.get("headers", {}),
                "connect-protocol-version": "1",
                "content-encoding": (
                    "identity" if self._compressor is None else self._compressor.name
                ),
                "content-type": f"application/{self._codec.content_type}",
            },
        }

    def _process_unary_response(
        self,
        http_resp: Response,
    ):
        if http_resp.status != 200:
            raise error_for_response(http_resp)

        content = http_resp.content

        if self._compressor is not None:
            content = self._compressor.decompress(content)

        return self._codec.decode(
            content,
            msg_type=self._response_type,
        )

    async def acall_unary(
        self,
        req,
        request_timeout=None,
        headers={},
        **opts,
    ):
        if self.async_pool is None:
            raise ValueError("async_pool is required")

        req_data = self._prepare_unary_request(
            req,
            request_timeout,
            headers,
            **opts,
        )

        conn = self.async_pool

        for _ in range(self._connection_retries):
            try:
                res = await conn.request(**req_data)
                return self._process_unary_response(res)
            except RemoteProtocolError:
                conn = self.async_pool.create_connection(URL(req_data["url"]).origin)

                continue
            except:
                raise

    def call_unary(self, req, request_timeout=None, headers={}, **opts):
        if self.pool is None:
            raise ValueError("pool is required")

        req_data = self._prepare_unary_request(
            req,
            request_timeout,
            headers,
            **opts,
        )

        conn = self.pool

        for _ in range(self._connection_retries):
            try:
                res = conn.request(**req_data)
                return self._process_unary_response(res)
            except RemoteProtocolError:
                conn = self.pool.create_connection(URL(req_data["url"]).origin)

                continue
            except:
                raise

    def _create_stream_timeout(self, timeout: Optional[int]):
        if timeout:
            return {"connect-timeout-ms": str(timeout * 1000)}
        return {}

    def _prepare_server_stream_request(
        self,
        req,
        request_timeout=None,
        timeout=None,
        headers={},
        **opts,
    ):
        data = self._codec.encode(req)
        flags = EnvelopeFlags(0)

        extensions = (
            None
            if request_timeout is None
            else {"timeout": {"connect": request_timeout, "pool": request_timeout}}
        )

        if self._compressor is not None:
            data = self._compressor.compress(data)
            flags |= EnvelopeFlags.compressed

        stream_timeout = self._create_stream_timeout(timeout)

        return {
            "method": "POST",
            "url": self.url,
            "content": encode_envelope(
                flags=flags,
                data=data,
            ),
            "extensions": extensions,
            "headers": {
                **self._headers,
                **headers,
                **opts.get("headers", {}),
                **stream_timeout,
                "connect-protocol-version": "1",
                "connect-content-encoding": (
                    "identity" if self._compressor is None else self._compressor.name
                ),
                "content-type": f"application/connect+{self._codec.content_type}",
            },
        }

    async def acall_server_stream(
        self,
        req,
        request_timeout=None,
        timeout=None,
        headers={},
        **opts,
    ):
        if self.async_pool is None:
            raise ValueError("async_pool is required")

        req_data = self._prepare_server_stream_request(
            req,
            request_timeout,
            timeout,
            headers,
            **opts,
        )

        conn = self.async_pool

        for _ in range(self._connection_retries):
            try:
                async with conn.stream(**req_data) as http_resp:
                    if http_resp.status != 200:
                        await http_resp.aread()
                        raise error_for_response(http_resp)

                    parser = ServerStreamParser(
                        decode=self._codec.decode,
                        response_type=self._response_type,
                    )

                    async for chunk in http_resp.aiter_stream():
                        for chunk in parser.parse(chunk):
                            yield chunk

                    return
            except RemoteProtocolError:
                conn = self.async_pool.create_connection(URL(req_data["url"]).origin)

                continue
            except:
                raise

    def call_server_stream(
        self,
        req,
        request_timeout=None,
        timeout=None,
        headers={},
        **opts,
    ):
        if self.pool is None:
            raise ValueError("pool is required")

        req_data = self._prepare_server_stream_request(
            req,
            request_timeout,
            timeout,
            headers,
            **opts,
        )

        conn = self.pool

        for _ in range(self._connection_retries):
            try:
                with conn.stream(**req_data) as http_resp:
                    if http_resp.status != 200:
                        raise error_for_response(http_resp)

                    parser = ServerStreamParser(
                        decode=self._codec.decode,
                        response_type=self._response_type,
                    )

                    for chunk in http_resp.iter_stream():
                        yield from parser.parse(chunk)

                    return
            except RemoteProtocolError:
                conn = self.pool.create_connection(URL(req_data["url"]).origin)

                continue
            except:
                raise

    def call_client_stream(self, req, **opts):
        raise NotImplementedError("client stream not supported")

    def acall_client_stream(self, req, **opts):
        raise NotImplementedError("client stream not supported")

    def call_bidi_stream(self, req, **opts):
        raise NotImplementedError("bidi stream not supported")

    def acall_bidi_stream(self, req, **opts):
        raise NotImplementedError("bidi stream not supported")


DataLen = int


class ServerStreamParser:
    def __init__(
        self,
        decode: Callable,
        response_type: Any,
    ):
        self.decode = decode
        self.response_type = response_type

        self.buffer: bytes = b""
        self._header: Optional[tuple[EnvelopeFlags, DataLen]] = None

    def shift_buffer(self, size: int):
        buffer = self.buffer[:size]
        self.buffer = self.buffer[size:]
        return buffer

    @property
    def header(self) -> Tuple[EnvelopeFlags, DataLen]:
        if self._header:
            return self._header

        header_data = self.shift_buffer(envelope_header_length)
        self._header = decode_envelope_header(header_data)

        return self._header

    @header.deleter
    def header(self):
        self._header = None

    def parse(self, chunk: bytes) -> Generator[Any, None, None]:
        self.buffer += chunk

        while len(self.buffer) >= envelope_header_length:
            flags, data_len = self.header

            if data_len > len(self.buffer):
                break

            data = self.shift_buffer(data_len)

            if EnvelopeFlags.end_stream in flags:
                data = json.loads(data)

                if "error" in data:
                    raise make_error(data["error"])

                return

            yield self.decode(data, msg_type=self.response_type)
            del self.header
