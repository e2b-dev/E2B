import pytest
from uuid import uuid4

from e2b import Template


@pytest.mark.skip_debug()
def test_build():
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .copy("folder/*.txt", "folder", force_upload=True)
        .set_envs(
            {
                "ENV_1": "value1",
                "ENV_2": "value2",
            }
        )
        .run_cmd("cat folder/test.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", Template.wait_for_timeout("10s"))
    )

    Template.build(
        template,
        alias=str(uuid4()),
        cpu_count=1,
        memory_mb=1024,
    )
