import pytest
from uuid import uuid4

from e2b import Template


@pytest.mark.skip_debug()
def test_run_command():
    template = Template().from_image("ubuntu:22.04").run_cmd("ls -l")

    Template.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
def test_run_command_as_different_user():
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .run_cmd('test "$(whoami)" = "root"', user="root")
    )

    Template.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
def test_run_command_as_user_that_does_not_exist():
    template = Template().from_image("ubuntu:22.04").run_cmd("whoami", user="root123")

    with pytest.raises(Exception) as exc_info:
        Template.build(
            template,
            alias=str(uuid4()),
        )

    assert (
        "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
        in str(exc_info.value)
    )
