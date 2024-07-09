import pytest

from e2b import Sandbox


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


def test_run_with_multiline_string(sandbox):
    text = "Hello,\nWorld!"

    cmd = sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


def test_run_with_timeout(sandbox):
    cmd = sandbox.commands.run('echo "Hello, World!"', timeout=1000)

    assert cmd.exit_code == 0


def test_run_with_too_short_timeout(sandbox):
    with pytest.raises(Exception):
        sandbox.commands.run("sleep 10", timeout_ms=1000)
