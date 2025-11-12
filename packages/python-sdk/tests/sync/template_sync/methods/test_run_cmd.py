import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_run_command(build):
    template = Template().from_image("ubuntu:22.04").skip_cache().run_cmd("ls -l")

    build(template)


@pytest.mark.skip_debug()
def test_run_command_as_different_user(build):
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .run_cmd('test "$(whoami)" = "root"', user="root")
    )

    build(template)


@pytest.mark.skip_debug()
def test_run_command_as_user_that_does_not_exist(build):
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .run_cmd("whoami", user="root123")
    )

    with pytest.raises(Exception) as exc_info:
        build(template)

    assert (
        "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
        in str(exc_info.value)
    )
