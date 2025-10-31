import pytest

from e2b import Sandbox


def test_command_envs(sandbox: Sandbox):
    cmd = sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.stdout.strip() == "bar"


@pytest.mark.skip_debug()
def test_sandbox_envs(sandbox_factory):
    sbx = sandbox_factory(envs={"FOO": "bar"})

    cmd = sbx.commands.run("echo $FOO")
    assert cmd.stdout.strip() == "bar"


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
