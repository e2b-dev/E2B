from dataclasses import dataclass
from typing import Optional
from unittest.mock import MagicMock

from e2b.sandbox.commands.command_handle import (
    CommandResult,
    CommandUsage,
    CommandExitException,
    _parse_usage,
)


@dataclass
class MockEndEvent:
    exit_code: int = 0
    error: Optional[str] = None
    cpu_seconds: float = 0.0
    memory_mb_max: float = 0.0


def test_parse_usage_with_data():
    end = MockEndEvent(cpu_seconds=1.5, memory_mb_max=256.0)
    usage = _parse_usage(end)
    assert usage is not None
    assert usage.cpu_seconds == 1.5
    assert usage.memory_mb_max == 256.0


def test_parse_usage_without_fields():
    end = MagicMock(spec=["exit_code", "error"])
    usage = _parse_usage(end)
    assert usage is None


def test_parse_usage_with_zero_values():
    end = MockEndEvent(cpu_seconds=0.0, memory_mb_max=0.0)
    usage = _parse_usage(end)
    assert usage is None


def test_command_result_usage_default_none():
    result = CommandResult(
        stdout="hello",
        stderr="",
        exit_code=0,
        error=None,
    )
    assert result.usage is None


def test_command_result_with_usage():
    usage = CommandUsage(cpu_seconds=2.3, memory_mb_max=128.5)
    result = CommandResult(
        stdout="hello",
        stderr="",
        exit_code=0,
        error=None,
        usage=usage,
    )
    assert result.usage is not None
    assert result.usage.cpu_seconds == 2.3
    assert result.usage.memory_mb_max == 128.5


def test_command_exit_exception_with_usage():
    usage = CommandUsage(cpu_seconds=0.5, memory_mb_max=64.0)
    exc = CommandExitException(
        stdout="",
        stderr="error output",
        exit_code=1,
        error="failed",
        usage=usage,
    )
    assert exc.usage is not None
    assert exc.usage.cpu_seconds == 0.5
    assert exc.usage.memory_mb_max == 64.0
    assert "exited with code 1" in str(exc)


def test_command_exit_exception_without_usage():
    exc = CommandExitException(
        stdout="",
        stderr="error output",
        exit_code=1,
        error="failed",
    )
    assert exc.usage is None


def test_parse_usage_exception_handling():
    """_parse_usage should return None if accessing attributes raises."""
    end = MagicMock()
    end.cpu_seconds = property(lambda self: (_ for _ in ()).throw(RuntimeError))
    usage = _parse_usage(end)
    assert usage is None
