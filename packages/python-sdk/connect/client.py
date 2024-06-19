import gzip
import json
import struct

from enum import Flag, IntEnum

from google.protobuf import json_format


class EnvelopeFlags(Flag):
    compressed = 0b00000001
    end_stream = 0b00000010


class Code(IntEnum):
    canceled = 408
    unknown = 500
    invalid_argument = 400
    deadline_exceeded = 408
    not_found = 404
    already_exists = 409
    permission_denied = 403
    resource_exhausted = 429
    failed_precondition = 412
    aborted = 409
    out_of_range = 400
    unimplemented = 404
    internal = 500
    unavailable = 503
    data_loss = 500
    unauthenticated = 401


class Error(Exception):
    def __init__(self, code, message):
        self.code = code
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


def error_for_response(http_resp, compressor):
    try:
        data = (
            http_resp.content
            if compressor is None
            else compressor.decompress(http_resp.content)
        )
        error = json.loads(data)
    except (json.decoder.JSONDecodeError, KeyError):
        return Error(Code(http_resp.status), http_resp.reason)
    else:
        return make_error(error)


def make_error(error):
    try:
        code = Code[error["code"]]
    except KeyError:
        code = Code.unknown
    return Error(code, error.get("message", ""))


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
        self, *, pool, url, response_type, compressor=None, json=False, headers=None
    ):
        if headers is None:
            headers = {}

        self.pool = pool
        self.url = url
        self._codec = JSONCodec if json else ProtobufCodec
        self._response_type = response_type
        self._compressor = compressor
        self._headers = {"user-agent": "connect-python"} | headers

    def call_unary(self, req, **opts):
        data = self._codec.encode(req)

        if self._compressor is not None:
            data = self._compressor.compress(data)

        http_resp = self.pool.request(
            "POST",
            self.url,
            content=data,
            headers=self._headers
            | opts.get("headers", {})
            | {
                "connect-protocol-version": "1",
                "content-encoding": (
                    "identity" if self._compressor is None else self._compressor.name
                ),
                "content-type": f"application/{self._codec.content_type}",
            },
        )

        content = http_resp.content

        if self._compressor is not None:
            content = self._compressor.decompress(content)

        if http_resp.status != 200:
            raise error_for_response(http_resp, self._compressor)

        return self._codec.decode(
            content,
            msg_type=self._response_type,
        )

    def call_server_stream(self, req, **opts):
        data = self._codec.encode(req)
        flags = EnvelopeFlags(0)

        if self._compressor is not None:
            data = self._compressor.compress(data)
            flags |= EnvelopeFlags.compressed

        with self.pool.stream(
            "POST",
            self.url,
            content=encode_envelope(
                flags=flags,
                data=data,
            ),
            headers=self._headers
            | opts.get("headers", {})
            | {
                "connect-protocol-version": "1",
                "connect-content-encoding": (
                    "identity" if self._compressor is None else self._compressor.name
                ),
                "content-type": f"application/connect+{self._codec.content_type}",
            },
        ) as http_resp:
            if http_resp.status != 200:
                raise error_for_response(http_resp, self._compressor)

            buffer = b""
            end_stream = False
            needs_header = True
            flags, data_len = 0, 0

            for chunk in http_resp.iter_stream():
                buffer += chunk

                if needs_header:
                    header = buffer[:envelope_header_length]
                    buffer = buffer[envelope_header_length:]
                    flags, data_len = decode_envelope_header(header)
                    needs_header = False
                    end_stream = EnvelopeFlags.end_stream in flags

                if len(buffer) >= data_len:
                    buffer = buffer[:data_len]

                    if end_stream:
                        data = json.loads(buffer)
                        if "error" in data:
                            raise make_error(data["error"])

                        # TODO: Figure out what else might be possible
                        return

                    if self._compressor is not None:
                        buffer = self._compressor.decompress(buffer)

                    # TODO: handle server message compression
                    # if EnvelopeFlags.compression in flags:
                    # TODO: should the client potentially use a different codec
                    # based on response header? Or can we assume they're always
                    # the same and an error otherwise.
                    yield self._codec.decode(buffer, msg_type=self._response_type)

                    buffer = buffer[data_len:]
                    needs_header = True

    def call_client_stream(self, req, **opts):
        raise NotImplementedError("client stream not supported")

    def call_bidi_stream(self, req, **opts):
        raise NotImplementedError("bidi stream not supported")
