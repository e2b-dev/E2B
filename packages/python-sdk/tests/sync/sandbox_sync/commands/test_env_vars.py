import pytest

from e2b import Sandbox


def test_command_envs(sandbox: Sandbox):
    cmd = sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.stdout.strip() == "bar"


@pytest.mark.skip_debug()
def test_sandbox_envs(template):
    sandbox = Sandbox(template, envs={"FOO": "bar"})
    try:
        cmd = sandbox.commands.run("echo $FOO")
        assert cmd.stdout.strip() == "bar"
    finally:
        sandbox.kill()


def test_bash_command_scoped_env_vars(sandbox: Sandbox):
    cmd = sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.exit_code == 0
    assert cmd.stdout.strip() == "bar"

    # test that it is secure and not accessible to subsequent commands
    cmd2 = sandbox.commands.run('sudo echo "$FOO"')
    assert cmd2.exit_code == 0
    assert cmd2.stdout.strip() == ""


def test_python_command_scoped_env_vars(sandbox: Sandbox):
    cmd = sandbox.commands.run(
        "python3 -c \"import os; print(os.environ['FOO'])\"", envs={"FOO": "bar"}
    )
    assert cmd.exit_code == 0
    assert cmd.stdout.strip() == "bar"


@pytest.mark.skip_debug()
def test_default_env_vars(template):
    sandbox = Sandbox(template)
    try:
        cmd = sandbox.commands.run('echo "$E2B_SANDBOX"')
        assert cmd.exit_code == 0
        assert cmd.stdout.strip() == "true"

        cmd2 = sandbox.commands.run("cat /run/e2b/.E2B_SANDBOX")
        assert cmd2.exit_code == 0
        assert cmd2.stdout.strip() == "true"

        cmd3 = sandbox.commands.run('echo "$E2B_SANDBOX_ID"')
        assert cmd3.exit_code == 0
        assert cmd3.stdout.strip() == sandbox.sandbox_id.split("-")[0]

        cmd4 = sandbox.commands.run("cat /run/e2b/.E2B_SANDBOX_ID")
        assert cmd4.exit_code == 0
        assert cmd4.stdout.strip() == sandbox.sandbox_id.split("-")[0]
    finally:
        sandbox.kill()
