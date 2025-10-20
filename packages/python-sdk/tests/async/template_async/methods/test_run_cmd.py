import pytest
from uuid import uuid4

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_run_command():
    template = AsyncTemplate().from_image("ubuntu:22.04").run_cmd("ls -l")

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
async def test_run_command_as_different_user():
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .run_cmd('test "$(whoami)" = "root"', user="root")
    )

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
async def test_run_command_as_user_that_does_not_exist():
    template = (
        AsyncTemplate().from_image("ubuntu:22.04").run_cmd("whoami", user="root123")
    )

    with pytest.raises(Exception) as exc_info:
        await AsyncTemplate.build(
            template,
            alias=str(uuid4()),
        )

    assert (
        "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
        in str(exc_info.value)
    )
