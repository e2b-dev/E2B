from e2b.envd.process import process_pb2
from e2b.envd.rpc import ProtoJSONCodec, request_timeout_ms, stream_timeout_ms


def test_request_timeout_ms_preserves_zero():
    assert request_timeout_ms(None) is None
    assert request_timeout_ms(0) == 0
    assert request_timeout_ms(0.0) == 0
    assert request_timeout_ms(1.25) == 1250


def test_stream_timeout_ms_uses_stream_timeout():
    assert stream_timeout_ms(60, 5) == 60000
    assert stream_timeout_ms(300, 5) == 300000
    assert stream_timeout_ms(None, 5) is None
    assert stream_timeout_ms(0, 5) is None
    assert stream_timeout_ms(0, None) is None
    assert stream_timeout_ms(60, None) == 60000


def test_proto_json_codec_ignores_unknown_fields():
    response = process_pb2.ListResponse()

    decoded = ProtoJSONCodec().decode(
        b'{"processes":[],"serverAddedField":"ignored"}',
        response,
    )

    assert decoded is response
    assert list(response.processes) == []
