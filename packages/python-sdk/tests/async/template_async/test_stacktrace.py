import pytest
import linecache

from e2b import AsyncTemplate, CopyItem, wait_for_timeout

non_existent_path = "/nonexistent/path"


async def _expect_to_throw_and_check_trace(func, expected_method: str):
    try:
        await func()
        assert False, "Expected AsyncTemplate.build to raise an exception"
    except Exception as e:  # noqa: BLE001 - we want to assert on the traceback regardless of type
        tb = e.__traceback__
        saw_this_file = False
        saw_expected_method = False
        while tb is not None:
            traceback_file = tb.tb_frame.f_code.co_filename
            if traceback_file == __file__:
                saw_this_file = True
                caller_line = linecache.getline(traceback_file, tb.tb_lineno)
                if caller_line and f".{expected_method}(" in caller_line:
                    saw_expected_method = True
                    break
            tb = tb.tb_next
        assert saw_this_file
        assert saw_expected_method


@pytest.mark.skip_debug()
async def test_traces_on_from_image(async_build):
    template = AsyncTemplate()
    template = template.skip_cache().from_image("e2b.dev/this-image-does-not-exist")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "from_image")


@pytest.mark.skip_debug()
async def test_traces_on_from_template(async_build):
    template = AsyncTemplate().from_template("this-template-does-not-exist")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "from_template"
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_dockerfile(async_build):
    template = AsyncTemplate()
    template = template.from_dockerfile("FROM ubuntu:22.04\nRUN nonexistent")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "from_dockerfile"
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_image_registry(async_build):
    template = AsyncTemplate()
    template = template.skip_cache().from_image(
        "registry.example.com/nonexistent:latest",
        username="test",
        password="test",
    )
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "from_image")


@pytest.mark.skip_debug()
async def test_traces_on_from_aws_registry(async_build):
    template = AsyncTemplate()
    template = template.skip_cache().from_aws_registry(
        "123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "from_aws_registry"
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_gcp_registry(async_build):
    template = AsyncTemplate()
    template = template.skip_cache().from_gcp_registry(
        "gcr.io/nonexistent-project/nonexistent:latest",
        service_account_json={
            "type": "service_account",
        },
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "from_gcp_registry"
    )


@pytest.mark.skip_debug()
async def test_traces_on_copy(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().copy(non_existent_path, non_existent_path)
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "copy")


@pytest.mark.skip_debug()
async def test_traces_on_copyItems(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().copy_items(
        [CopyItem(src=non_existent_path, dest=non_existent_path)]
    )
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "copy_items")


@pytest.mark.skip_debug()
async def test_traces_on_remove(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().remove(non_existent_path)
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "remove")


@pytest.mark.skip_debug()
async def test_traces_on_rename(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().rename(non_existent_path, "/tmp/dest.txt")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "rename")


@pytest.mark.skip_debug()
async def test_traces_on_make_dir(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_user("root").skip_cache().make_dir("/root/.bashrc")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "make_dir")


@pytest.mark.skip_debug()
async def test_traces_on_make_symlink(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().make_symlink(".bashrc", ".bashrc")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "make_symlink"
    )


@pytest.mark.skip_debug()
async def test_traces_on_run_cmd(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().run_cmd(f"cat {non_existent_path}")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "run_cmd")


@pytest.mark.skip_debug()
async def test_traces_on_set_workdir(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_user("root").skip_cache().set_workdir("/root/.bashrc")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "set_workdir")


@pytest.mark.skip_debug()
async def test_traces_on_set_user(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().set_user("; exit 1")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "set_user")


@pytest.mark.skip_debug()
async def test_traces_on_pip_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().pip_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "pip_install")


@pytest.mark.skip_debug()
async def test_traces_on_npm_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().npm_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "npm_install")


@pytest.mark.skip_debug()
async def test_traces_on_apt_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().apt_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "apt_install")


@pytest.mark.skip_debug()
async def test_traces_on_git_clone(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().git_clone("https://github.com/repo.git")
    await _expect_to_throw_and_check_trace(lambda: async_build(template), "git_clone")


@pytest.mark.skip_debug()
async def test_traces_on_start_cmd(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_start_cmd(
        f"./{non_existent_path}", wait_for_timeout(10_000)
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "set_start_cmd"
    )


@pytest.mark.skip_debug()
async def test_traces_on_add_mcp_server():
    # needs mcp-gateway as base template, without it no mcp servers can be added
    await _expect_to_throw_and_check_trace(
        lambda: AsyncTemplate().from_base_image().add_mcp_server("exa"),
        "add_mcp_server",
    )


@pytest.mark.skip_debug()
async def test_traces_on_devcontainer_prebuild(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().devcontainer_prebuild(non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "devcontainer_prebuild"
    )


@pytest.mark.skip_debug()
async def test_traces_on_set_devcontainer_start(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_devcontainer_start(non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template), "set_devcontainer_start"
    )
