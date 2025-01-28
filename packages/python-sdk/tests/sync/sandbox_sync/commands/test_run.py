import pytest

from e2b import Sandbox, TimeoutException


def test_run(sandbox: Sandbox):
    text = "Hello, World!"

    cmd = sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


def test_run_with_special_characters(sandbox: Sandbox):
    text = "!@#$%^&*()_+"

    cmd = sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


def test_run_with_broken_utf8(sandbox: Sandbox):
    # Create a string with 8191 'a' characters followed by the problematic byte 0xe2
    long_str = "a" * 8191 + "\\xe2"
    result = sandbox.commands.run(f'printf "{long_str}"')
    assert result.exit_code == 0

    # The broken UTF-8 bytes should be replaced with the Unicode replacement character
    assert result.stdout == ("a" * 8191 + "\ufffd")


def test_run_with_multiline_string(sandbox):
    text = "Hello,\nWorld!"

    cmd = sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


def test_run_with_timeout(sandbox):
    cmd = sandbox.commands.run('echo "Hello, World!"', timeout=10)

    assert cmd.exit_code == 0


def test_run_with_too_short_timeout(sandbox):
    with pytest.raises(TimeoutException):
        sandbox.commands.run("sleep 10", timeout=2)


def test_run_with_too_short_timeout_iterating(sandbox):
    cmd = sandbox.commands.run("sleep 10", timeout=2, background=True)
    with pytest.raises(TimeoutException):
        for _ in cmd:
            pass
