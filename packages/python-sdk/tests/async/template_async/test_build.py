import pytest
import os
from uuid import uuid4
import shutil

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_build():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    folder_path = os.path.join(test_dir, "folder")

    os.makedirs(folder_path, exist_ok=True)
    with open(os.path.join(folder_path, "test.txt"), "w") as f:
        f.write("test")

    template = (
        AsyncTemplate()
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
        .set_start_cmd("echo 'Hello, world!'", AsyncTemplate.wait_for_timeout(10000))
    )

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
        cpu_count=1,
        memory_mb=1024,
    )

    shutil.rmtree(folder_path)
