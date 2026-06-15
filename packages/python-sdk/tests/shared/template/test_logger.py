from datetime import datetime

from e2b.template.logger import LogEntry


def test_strips_ansi_escape_codes_from_the_message():
    entry = LogEntry(
        timestamp=datetime(2025, 1, 1),
        level="info",
        message="\x1b[31mred text\x1b[0m",
    )

    assert entry.message == "red text"


def test_keeps_plain_messages_unchanged():
    entry = LogEntry(
        timestamp=datetime(2025, 1, 1),
        level="info",
        message="plain message",
    )

    assert entry.message == "plain message"
