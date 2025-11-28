import traceback
from types import SimpleNamespace
from typing import Optional
from uuid import uuid4

import pytest
import linecache

from e2b import AsyncTemplate, CopyItem, wait_for_timeout
from e2b.api.client.models import TemplateBuildStatus
import e2b.template_async.main as template_async_main
import e2b.template_async.build_api as build_api_mod

non_existent_path = "/nonexistent/path"

# map template alias -> failed step index
failure_map: dict[str, Optional[int]] = {
    "from_image": 0,
    "from_template": 0,
    "from_dockerfile": 0,
    "from_image_registry": 0,
    "from_aws_registry": 0,
    "from_gcp_registry": 0,
    "copy": None,
    "copy_items": None,
    "remove": 1,
    "rename": 1,
    "make_dir": 1,
    "make_symlink": 1,
    "run_cmd": 1,
    "set_workdir": 1,
    "set_user": 1,
    "pip_install": 1,
    "npm_install": 1,
    "apt_install": 1,
    "git_clone": 1,
    "set_start_cmd": 1,
    "add_mcp_server": None,
    "beta_dev_container_prebuild": 1,
    "beta_set_dev_container_start": 1,
}


@pytest.fixture(autouse=True)
def mock_template_build(monkeypatch):
    async def mock_request_build(client, name: str, cpu_count: int, memory_mb: int):
        return SimpleNamespace(template_id=name, build_id=str(uuid4()))

    async def mock_trigger_build(client, template_id: str, build_id: str, template):
        return None

    async def mock_get_build_status(
        client, template_id: str, build_id: str, logs_offset: int
    ):
        step = failure_map[template_id]
        reason = SimpleNamespace(
            message="Mocked API build error",
            log_entries=[],
            step=str(step) if step is not None else None,
        )
        return SimpleNamespace(
            status=TemplateBuildStatus.ERROR,
            log_entries=[],
            reason=reason,
        )

    monkeypatch.setattr(template_async_main, "request_build", mock_request_build)
    monkeypatch.setattr(template_async_main, "trigger_build", mock_trigger_build)
    monkeypatch.setattr(build_api_mod, "get_build_status", mock_get_build_status)


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
        assert saw_this_file, traceback.format_exc()
        assert saw_expected_method, traceback.format_exc()


@pytest.mark.skip_debug()
async def test_traces_on_from_image(async_build):
    template = AsyncTemplate().from_image("e2b.dev/this-image-does-not-exist")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_image", skip_cache=True), "from_image"
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_template(async_build):
    template = AsyncTemplate().from_template("this-template-does-not-exist")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_template", skip_cache=True),
        "from_template",
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_dockerfile(async_build):
    template = AsyncTemplate().from_dockerfile("FROM ubuntu:22.04\nRUN nonexistent")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_dockerfile", skip_cache=True),
        "from_dockerfile",
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_image_registry(async_build):
    template = AsyncTemplate().from_image(
        "registry.example.com/nonexistent:latest",
        username="test",
        password="test",
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_image_registry", skip_cache=True),
        "from_image",
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_aws_registry(async_build):
    template = AsyncTemplate().from_aws_registry(
        "123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_aws_registry"), "from_aws_registry"
    )


@pytest.mark.skip_debug()
async def test_traces_on_from_gcp_registry(async_build):
    template = AsyncTemplate().from_gcp_registry(
        "gcr.io/nonexistent-project/nonexistent:latest",
        service_account_json={
            "type": "service_account",
        },
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="from_gcp_registry"), "from_gcp_registry"
    )


@pytest.mark.skip_debug()
async def test_traces_on_copy(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().copy(non_existent_path, non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="copy"), "copy"
    )


@pytest.mark.skip_debug()
async def test_traces_on_copyItems(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().copy_items(
        [CopyItem(src=non_existent_path, dest=non_existent_path)]
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="copy_items"), "copy_items"
    )


@pytest.mark.skip_debug()
async def test_traces_on_remove(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().remove(non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="remove"), "remove"
    )


@pytest.mark.skip_debug()
async def test_traces_on_rename(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().rename(non_existent_path, "/tmp/dest.txt")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="rename"), "rename"
    )


@pytest.mark.skip_debug()
async def test_traces_on_make_dir(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_user("root").skip_cache().make_dir("/root/.bashrc")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="make_dir"), "make_dir"
    )


@pytest.mark.skip_debug()
async def test_traces_on_make_symlink(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().make_symlink(".bashrc", ".bashrc")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="make_symlink"), "make_symlink"
    )


@pytest.mark.skip_debug()
async def test_traces_on_run_cmd(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().run_cmd(f"cat {non_existent_path}")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="run_cmd"), "run_cmd"
    )


@pytest.mark.skip_debug()
async def test_traces_on_set_workdir(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_user("root").skip_cache().set_workdir("/root/.bashrc")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="set_workdir"), "set_workdir"
    )


@pytest.mark.skip_debug()
async def test_traces_on_set_user(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().set_user("; exit 1")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="set_user"), "set_user"
    )


@pytest.mark.skip_debug()
async def test_traces_on_pip_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().pip_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="pip_install"), "pip_install"
    )


@pytest.mark.skip_debug()
async def test_traces_on_npm_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().npm_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="npm_install"), "npm_install"
    )


@pytest.mark.skip_debug()
async def test_traces_on_apt_install(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().apt_install("nonexistent-package")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="apt_install"), "apt_install"
    )


@pytest.mark.skip_debug()
async def test_traces_on_git_clone(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.skip_cache().git_clone("https://github.com/repo.git")
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="git_clone"), "git_clone"
    )


@pytest.mark.skip_debug()
async def test_traces_on_start_cmd(async_build):
    template = AsyncTemplate()
    template = template.from_base_image()
    template = template.set_start_cmd(
        f"./{non_existent_path}", wait_for_timeout(10_000)
    )
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="set_start_cmd"), "set_start_cmd"
    )


@pytest.mark.skip_debug()
async def test_traces_on_add_mcp_server():
    # needs mcp-gateway as base template, without it no mcp servers can be added
    await _expect_to_throw_and_check_trace(
        lambda: AsyncTemplate().from_base_image().skip_cache().add_mcp_server("exa"),
        "add_mcp_server",
    )


@pytest.mark.skip_debug()
async def test_traces_on_dev_container_prebuild(async_build):
    template = AsyncTemplate()
    template = template.from_template("devcontainer")
    template = template.skip_cache().beta_dev_container_prebuild(non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="beta_dev_container_prebuild"),
        "beta_dev_container_prebuild",
    )


@pytest.mark.skip_debug()
async def test_traces_on_set_dev_container_start(async_build):
    template = AsyncTemplate()
    template = template.from_template("devcontainer")
    template = template.beta_set_dev_container_start(non_existent_path)
    await _expect_to_throw_and_check_trace(
        lambda: async_build(template, alias="beta_set_dev_container_start"),
        "beta_set_dev_container_start",
    )
