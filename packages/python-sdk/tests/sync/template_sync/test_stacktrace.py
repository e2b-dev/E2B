import pytest
from uuid import uuid4
import linecache

from e2b import Template, wait_for_timeout, TemplateClass

non_existent_path = "/nonexistent/path"


def build(template: TemplateClass):
    return Template.build(
        template,
        alias=str(uuid4()),
        cpu_count=1,
        memory_mb=1024,
    )


def _expect_to_throw_and_check_trace(func, expected_method: str):
    try:
        func()
        assert False, "Expected Template.build to raise an exception"
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
def test_build():
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .run_cmd("cat non_existing_file.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", wait_for_timeout(10_000))
    )

    try:
        Template.build(
            template,
            alias=str(uuid4()),
            cpu_count=1,
            memory_mb=1024,
        )
    except Exception as e:
        traceback_file = None
        latest_traceback = e.__traceback__
        if latest_traceback is not None:
            traceback_file = latest_traceback.tb_frame.f_code.co_filename
        assert __file__ == traceback_file


@pytest.mark.skip_debug()
def test_traces_on_from_image():
    template = Template().from_image("e2b.dev/this-image-does-not-exist")
    _expect_to_throw_and_check_trace(lambda: build(template), "from_image")


@pytest.mark.skip_debug()
def test_traces_on_from_template():
    template = Template().from_template("this-template-does-not-exist")
    _expect_to_throw_and_check_trace(lambda: build(template), "from_template")


@pytest.mark.skip_debug()
def test_traces_on_from_dockerfile():
    template = Template().from_dockerfile("FROM ubuntu:22.04\nRUN nonexistent")
    _expect_to_throw_and_check_trace(lambda: build(template), "from_dockerfile")


@pytest.mark.skip_debug()
def test_traces_on_from_registry():
    template = Template().from_registry(
        "registry.example.com/nonexistent:latest",
        username="test",
        password="test",
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_registry")


@pytest.mark.skip_debug()
def test_traces_on_from_aws_registry():
    template = Template().from_aws_registry(
        "123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_aws_registry")


@pytest.mark.skip_debug()
def test_traces_on_from_gcp_registry():
    template = Template().from_gcp_registry(
        "gcr.io/nonexistent-project/nonexistent:latest",
        service_account_json={"type": "service_account"},
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_gcp_registry")


@pytest.mark.skip_debug()
def test_traces_on_copy():
    template = (
        Template().from_base_image().copy(non_existent_path, non_existent_path)
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "copy")


@pytest.mark.skip_debug()
def test_traces_on_remove():
    template = Template().from_base_image().remove(non_existent_path)
    _expect_to_throw_and_check_trace(lambda: build(template), "remove")


@pytest.mark.skip_debug()
def test_traces_on_rename():
    template = (
        Template().from_base_image().rename(non_existent_path, "/tmp/dest.txt")
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "rename")


@pytest.mark.skip_debug()
def test_traces_on_make_dir():
    template = Template().from_base_image().make_dir(".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "make_dir")


@pytest.mark.skip_debug()
def test_traces_on_make_symlink():
    template = Template().from_base_image().make_symlink(".bashrc", ".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "make_symlink")


@pytest.mark.skip_debug()
def test_traces_on_run_cmd():
    template = Template().from_base_image().run_cmd(f"cat {non_existent_path}")
    _expect_to_throw_and_check_trace(lambda: build(template), "run_cmd")


@pytest.mark.skip_debug()
def test_traces_on_set_workdir():
    template = Template().from_base_image().set_workdir(".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "set_workdir")


@pytest.mark.skip_debug()
def test_traces_on_set_user():
    template = Template().from_base_image().set_user(";")
    _expect_to_throw_and_check_trace(lambda: build(template), "set_user")


@pytest.mark.skip_debug()
def test_traces_on_pip_install():
    template = Template().from_base_image().pip_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "pip_install")


@pytest.mark.skip_debug()
def test_traces_on_npm_install():
    template = Template().from_base_image().npm_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "npm_install")


@pytest.mark.skip_debug()
def test_traces_on_apt_install():
    template = Template().from_base_image().apt_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "apt_install")


@pytest.mark.skip_debug()
def test_traces_on_git_clone():
    template = (
        Template()
        .from_base_image()
        .git_clone("https://github.com/nonexistent/repo.git")
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "git_clone")


@pytest.mark.skip_debug()
def test_traces_on_set_start_cmd():
    template = (
        Template()
        .from_base_image()
        .set_start_cmd(f"./{non_existent_path}", wait_for_timeout(10_000))
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "set_start_cmd")
