import pytest
from uuid import uuid4
import linecache

from e2b import AsyncTemplate, wait_for_timeout, TemplateClass

non_existent_path = "/nonexistent/path"


async def build(template: TemplateClass):
    return await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
        cpu_count=1,
        memory_mb=1024,
    )


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
async def test_traces_on_from_image():
    template = AsyncTemplate()
    template = template.from_image("e2b.dev/this-image-does-not-exist")
    await _expect_to_throw_and_check_trace(lambda: build(template), "from_image")


# @pytest.mark.skip_debug()
# async def test_traces_on_from_template():
#     template = AsyncTemplate().from_template("this-template-does-not-exist")
#     await _expect_to_throw_and_check_trace(lambda: build(template), "from_template")


@pytest.mark.skip_debug()
async def test_traces_on_from_dockerfile():
    template = AsyncTemplate()
    template = template.from_dockerfile("FROM ubuntu:22.04\nRUN nonexistent")
    await _expect_to_throw_and_check_trace(lambda: build(template), "from_dockerfile")


@pytest.mark.skip_debug()
async def test_traces_on_from_registry():
    template = AsyncTemplate()
    template = template.from_registry(
        "registry.example.com/nonexistent:latest",
        username="test",
        password="test",
    )
    await _expect_to_throw_and_check_trace(lambda: build(template), "from_registry")


@pytest.mark.skip_debug()
async def test_traces_on_from_aws_registry():
    template = AsyncTemplate()
    template = template.from_aws_registry(
        "123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
    )
    await _expect_to_throw_and_check_trace(lambda: build(template), "from_aws_registry")


@pytest.mark.skip_debug()
async def test_traces_on_from_gcp_registry():
    template = AsyncTemplate()
    template = template.from_gcp_registry(
        "gcr.io/nonexistent-project/nonexistent:latest",
        service_account_json={
            "type": "service_account",
        },
    )
    await _expect_to_throw_and_check_trace(lambda: build(template), "from_gcp_registry")


@pytest.mark.skip_debug()
async def test_traces_on_copy():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.copy(non_existent_path, non_existent_path)
    await _expect_to_throw_and_check_trace(lambda: build(template), "copy")


@pytest.mark.skip_debug()
async def test_traces_on_remove():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.remove(non_existent_path)
    await _expect_to_throw_and_check_trace(lambda: build(template), "remove")


@pytest.mark.skip_debug()
async def test_traces_on_rename():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.rename(non_existent_path, "/tmp/dest.txt")
    await _expect_to_throw_and_check_trace(lambda: build(template), "rename")


@pytest.mark.skip_debug()
async def test_traces_on_make_dir():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.make_dir(".bashrc")
    await _expect_to_throw_and_check_trace(lambda: build(template), "make_dir")


@pytest.mark.skip_debug()
async def test_traces_on_make_symlink():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.make_symlink(".bashrc", ".bashrc")
    await _expect_to_throw_and_check_trace(lambda: build(template), "make_symlink")


@pytest.mark.skip_debug()
async def test_traces_on_run_cmd():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.run_cmd(f"cat {non_existent_path}")
    await _expect_to_throw_and_check_trace(lambda: build(template), "run_cmd")


@pytest.mark.skip_debug()
async def test_traces_on_set_workdir():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_workdir(".bashrc")
    await _expect_to_throw_and_check_trace(lambda: build(template), "set_workdir")


@pytest.mark.skip_debug()
async def test_traces_on_set_user():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_user(";")
    await _expect_to_throw_and_check_trace(lambda: build(template), "set_user")


@pytest.mark.skip_debug()
async def test_traces_on_pip_install():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.pip_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: build(template), "pip_install")


@pytest.mark.skip_debug()
async def test_traces_on_npm_install():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.npm_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: build(template), "npm_install")


@pytest.mark.skip_debug()
async def test_traces_on_apt_install():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.apt_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(lambda: build(template), "apt_install")


@pytest.mark.skip_debug()
async def test_traces_on_git_clone():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.git_clone("https://github.com/repo.git")
    await _expect_to_throw_and_check_trace(lambda: build(template), "git_clone")


@pytest.mark.skip_debug()
async def test_traces_on_set_start_cmd():
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_start_cmd(f"./{non_existent_path}", wait_for_timeout(10_000))
    await _expect_to_throw_and_check_trace(lambda: build(template), "set_start_cmd")
