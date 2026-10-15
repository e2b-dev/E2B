import pytest

from e2b import InvalidArgumentException, SandboxException
from e2b_acp.utils import (
    PARSE_ERROR_RESPONSE,
    LineSplitter,
    filter_agent_message,
    parse_agent_line,
    restrict_client_capabilities,
)


def test_line_splitter_joins_chunks_split_mid_line():
    lines = LineSplitter(1024)

    assert lines.push('{"a":') == []
    assert lines.push('1}\n{"b"') == ['{"a":1}']
    assert lines.push(":2}\n\n") == ['{"b":2}', ""]
    assert lines.flush() == ""


def test_line_splitter_keeps_trailing_partial_line_for_flush():
    lines = LineSplitter(1024)

    assert lines.push('{"a":1}\n{"b":2}') == ['{"a":1}']
    assert lines.flush() == '{"b":2}'


def test_line_splitter_rejects_messages_over_the_limit_in_bytes():
    lines = LineSplitter(8)

    assert lines.push("1234567\n") == ["1234567"]
    # Four 3-byte characters are 12 bytes.
    with pytest.raises(SandboxException, match="exceeds the limit of 8 bytes"):
        lines.push("€€€€")


def test_initialize_turns_off_client_filesystem_and_terminal():
    message = {
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": {
            "protocolVersion": 1,
            "clientCapabilities": {
                "fs": {"readTextFile": True, "writeTextFile": True},
                "terminal": True,
                "_meta": {"custom": True},
            },
        },
    }

    restricted = restrict_client_capabilities(message)

    assert restricted["params"] == {
        "protocolVersion": 1,
        "clientCapabilities": {
            "fs": {"readTextFile": False, "writeTextFile": False},
            "terminal": False,
            "_meta": {"custom": True},
        },
    }
    assert message["params"]["clientCapabilities"]["terminal"] is True


def test_other_client_messages_pass_unchanged():
    message = {"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}}

    assert restrict_client_capabilities(message) is message


def test_agent_requests_for_client_fs_and_terminal_are_rejected():
    forward, replies = filter_agent_message(
        {"jsonrpc": "2.0", "id": 7, "method": "fs/write_text_file", "params": {}}
    )

    assert forward is None
    assert len(replies) == 1
    assert replies[0]["id"] == 7
    assert replies[0]["error"]["code"] == -32601


def test_agent_notifications_for_client_terminal_are_dropped_silently():
    assert filter_agent_message({"jsonrpc": "2.0", "method": "terminal/release"}) == (
        None,
        [],
    )


def test_batches_keep_only_forwardable_messages():
    update = {"jsonrpc": "2.0", "method": "session/update", "params": {}}
    forward, replies = filter_agent_message(
        [update, {"jsonrpc": "2.0", "id": "x", "method": "terminal/create"}]
    )

    assert forward == [update]
    assert len(replies) == 1


def test_other_agent_messages_are_forwarded():
    message = {"jsonrpc": "2.0", "id": 3, "method": "session/request_permission"}

    assert filter_agent_message(message) == (message, [])


def test_invalid_agent_line_gets_a_parse_error():
    assert parse_agent_line("not json") == (None, [PARSE_ERROR_RESPONSE])
    assert parse_agent_line("   ") == (None, [])


def test_initialize_inside_a_batch_is_restricted_too():
    [restricted] = restrict_client_capabilities(
        [{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}}]
    )

    assert restricted["params"]["clientCapabilities"] == {
        "fs": {"readTextFile": False, "writeTextFile": False},
        "terminal": False,
    }


@pytest.mark.parametrize("limit", [0, -1, 1.5, float("nan"), float("inf"), True])
def test_message_limit_must_be_a_positive_integer(limit):
    with pytest.raises(InvalidArgumentException, match="positive integer"):
        LineSplitter(limit)
