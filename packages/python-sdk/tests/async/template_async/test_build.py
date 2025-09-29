import pytest
import os
import shutil

from e2b import AsyncTemplate, wait_for_timeout


@pytest.mark.skip_debug()
async def test_build(async_build):
    test_dir = os.path.dirname(os.path.abspath(__file__))
    folder_path = os.path.join(test_dir, "folder")

    os.makedirs(folder_path, exist_ok=True)
    with open(os.path.join(folder_path, "test.txt"), "w") as f:
        f.write("test")

    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .copy("folder/*.txt", "folder", force_upload=True)
        .copy("folder", "folder2", force_upload=True)
        .set_envs(
            {
                "ENV_1": "value1",
                "ENV_2": "value2",
            }
        )
        .run_cmd("cat folder/test.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", wait_for_timeout(10_000))
    )

    await async_build(template)

    shutil.rmtree(folder_path)
