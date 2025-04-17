import pytest

from e2b import AsyncSandbox


async def test_command_envs(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("echo $FOO", envs={"FOO": "bar"})
    assert cmd.stdout.strip() == "bar"


@pytest.mark.skip_debug()
async def test_sandbox_envs(template: str):
    try:
        sbx = await AsyncSandbox.create(
            template=template, envs={"FOO": "bar"}, auto_pause=True
        )
        cmd = await sbx.commands.run("echo $FOO")
        assert cmd.stdout.strip() == "bar"
    finally:
        await sbx.kill()
