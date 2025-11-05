import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_run_command(async_build):
    template = AsyncTemplate().from_image("ubuntu:22.04").skip_cache().run_cmd("ls -l")

    await async_build(template)


@pytest.mark.skip_debug()
async def test_run_command_as_different_user(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .run_cmd('test "$(whoami)" = "root"', user="root")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_run_command_as_user_that_does_not_exist(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .run_cmd("whoami", user="root123")
    )

    with pytest.raises(Exception) as exc_info:
        await async_build(template)

    assert (
        "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
        in str(exc_info.value)
    )
