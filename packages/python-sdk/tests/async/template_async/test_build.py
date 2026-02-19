import os
import shutil
import tempfile

import pytest

from e2b import AsyncTemplate, default_build_logger, wait_for_timeout


@pytest.fixture(scope="module")
def setup_test_folder():
    test_dir = tempfile.mkdtemp(prefix="python_async_test_")
    folder_path = os.path.join(test_dir, "folder")

    os.makedirs(folder_path, exist_ok=True)
    with open(os.path.join(folder_path, "test.txt"), "w") as f:
        f.write("This is a test file.")

    # Create relative symlink
    symlink_path = os.path.join(folder_path, "symlink.txt")
    if os.path.exists(symlink_path):
        os.remove(symlink_path)
    os.symlink("test.txt", symlink_path)

    # Create absolute symlink
    symlink2_path = os.path.join(folder_path, "symlink2.txt")
    if os.path.exists(symlink2_path):
        os.remove(symlink2_path)
    os.symlink(os.path.join(folder_path, "test.txt"), symlink2_path)

    # Create a symlink to a file that does not exist
    symlink3_path = os.path.join(folder_path, "symlink3.txt")
    if os.path.exists(symlink3_path):
        os.remove(symlink3_path)
    os.symlink("12345test.txt", symlink3_path)

    yield test_dir

    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.mark.skip_debug()
async def test_build_template(async_build, setup_test_folder):
    template = (
        AsyncTemplate(file_context_path=setup_test_folder)
        .from_base_image()
        .copy("folder/*", "folder", force_upload=True)
        .run_cmd("cat folder/test.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", wait_for_timeout(10_000))
    )

    await async_build(template, skip_cache=True, on_build_logs=default_build_logger())


@pytest.mark.skip_debug()
async def test_build_template_from_base_template(async_build):
    template = AsyncTemplate().from_template("base")
    await async_build(template, skip_cache=True, on_build_logs=default_build_logger())


@pytest.mark.skip_debug()
async def test_build_template_with_symlinks(async_build, setup_test_folder):
    template = (
        AsyncTemplate(file_context_path=setup_test_folder)
        .from_image("ubuntu:22.04")
        .skip_cache()
        .copy("folder/*", "folder", force_upload=True)
        .run_cmd("cat folder/symlink.txt")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_build_template_with_resolve_symlinks(async_build, setup_test_folder):
    template = (
        AsyncTemplate(file_context_path=setup_test_folder)
        .from_image("ubuntu:22.04")
        .skip_cache()
        .copy(
            "folder/symlink.txt",
            "folder/symlink.txt",
            force_upload=True,
            resolve_symlinks=True,
        )
        .run_cmd("cat folder/symlink.txt")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_build_template_with_skip_cache(async_build, setup_test_folder):
    template = (
        AsyncTemplate(file_context_path=setup_test_folder)
        .skip_cache()
        .from_image("ubuntu:22.04")
    )

    await async_build(template)
