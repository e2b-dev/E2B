from e2b.envd.process import process_pb2
from e2b.envd.rpc import (
    STREAM_REQUEST_TIMEOUT_HEADER,
    ProtoJSONCodec,
    request_timeout_ms,
    stream_request_headers,
    stream_timeout_ms,
)


def test_request_timeout_ms_preserves_zero():
    assert request_timeout_ms(None) is None
    assert request_timeout_ms(0) == 0
    assert request_timeout_ms(0.0) == 0
    assert request_timeout_ms(1.25) == 1250


def test_stream_timeout_ms_uses_stream_timeout():
    assert stream_timeout_ms(60) == 60000
    assert stream_timeout_ms(300) == 300000
    assert stream_timeout_ms(None) is None
    assert stream_timeout_ms(0) is None


def test_stream_request_headers_adds_transport_timeout():
    headers = stream_request_headers({"x-test": "1"}, 5)

    assert headers == {"x-test": "1", STREAM_REQUEST_TIMEOUT_HEADER: "5"}


def test_stream_request_headers_ignores_unlimited_timeout():
    headers = {"x-test": "1"}

    assert stream_request_headers(headers, None) is headers
    assert stream_request_headers(headers, 0) is headers


def test_proto_json_codec_ignores_unknown_fields():
    response = process_pb2.ListResponse()

    decoded = ProtoJSONCodec().decode(
        b'{"processes":[],"serverAddedField":"ignored"}',
        response,
    )

    assert decoded is response
    assert list(response.processes) == []
