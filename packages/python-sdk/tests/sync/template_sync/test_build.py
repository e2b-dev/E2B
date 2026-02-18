import tempfile

import pytest
import os
import shutil

from e2b import Template, wait_for_timeout, default_build_logger


@pytest.fixture(scope="module")
def setup_test_folder():
    test_dir = tempfile.mkdtemp(prefix="python_sync_test_")
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
def test_build_template(build, setup_test_folder):
    template = (
        Template(file_context_path=setup_test_folder)
        # using base image to avoid re-building ubuntu:22.04 image
        .from_base_image()
        .copy("folder/*", "folder", force_upload=True)
        .run_cmd("cat folder/test.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", wait_for_timeout(10_000))
    )

    build(template, skip_cache=True, on_build_logs=default_build_logger())


@pytest.mark.skip_debug()
def test_build_template_from_base_template(build):
    template = Template().from_template("base")
    build(template, skip_cache=True, on_build_logs=default_build_logger())


@pytest.mark.skip_debug()
def test_build_template_with_symlinks(build, setup_test_folder):
    template = (
        Template(file_context_path=setup_test_folder)
        .from_image("ubuntu:22.04")
        .skip_cache()
        .copy("folder/*", "folder", force_upload=True)
        .run_cmd("cat folder/symlink.txt")
    )

    build(template)


@pytest.mark.skip_debug()
def test_build_template_with_resolve_symlinks(build, setup_test_folder):
    template = (
        Template(file_context_path=setup_test_folder)
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

    build(template)
