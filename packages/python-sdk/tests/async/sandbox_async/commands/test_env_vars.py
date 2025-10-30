import pytest

from e2b import AsyncSandbox


async def test_command_envs(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.stdout.strip() == "bar"


@pytest.mark.skip_debug()
async def test_sandbox_envs(async_sandbox_factory):
    sbx = await async_sandbox_factory(envs={"FOO": "bar"})

    cmd = await sbx.commands.run("echo $FOO")
    assert cmd.stdout.strip() == "bar"


async def test_bash_command_scoped_env_vars(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.exit_code == 0
    assert cmd.stdout.strip() == "bar"

    # test that it is secure and not accessible to subsequent commands
    cmd2 = await async_sandbox.commands.run('sudo echo "$FOO"')
    assert cmd2.exit_code == 0
    assert cmd2.stdout.strip() == ""


async def test_python_command_scoped_env_vars(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run(
        "python3 -c \"import os; print(os.environ['FOO'])\"", envs={"FOO": "bar"}
    )
    assert cmd.exit_code == 0
    assert cmd.stdout.strip() == "bar"
