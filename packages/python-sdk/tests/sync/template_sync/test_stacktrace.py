import pytest
import linecache

from e2b import Template, CopyItem, wait_for_timeout

non_existent_path = "/nonexistent/path"


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
def test_traces_on_from_image(build):
    template = Template()
    template = template.skip_cache().from_image("e2b.dev/this-image-does-not-exist")
    _expect_to_throw_and_check_trace(lambda: build(template), "from_image")


# @pytest.mark.skip_debug()
# def test_traces_on_from_template(build):
#     template = Template().from_template("this-template-does-not-exist")
#     _expect_to_throw_and_check_trace(lambda: build(template), "from_template")


@pytest.mark.skip_debug()
def test_traces_on_from_dockerfile(build):
    template = Template()
    template = template.from_dockerfile("FROM ubuntu:22.04\nRUN nonexistent")
    _expect_to_throw_and_check_trace(lambda: build(template), "from_dockerfile")


@pytest.mark.skip_debug()
def test_traces_on_from_image_registry(build):
    template = Template()
    template = template.skip_cache().from_image(
        "registry.example.com/nonexistent:latest",
        username="test",
        password="test",
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_image")


@pytest.mark.skip_debug()
def test_traces_on_from_aws_registry(build):
    template = Template()
    template = template.skip_cache().from_aws_registry(
        "123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest",
        access_key_id="test",
        secret_access_key="test",
        region="us-east-1",
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_aws_registry")


@pytest.mark.skip_debug()
def test_traces_on_from_gcp_registry(build):
    template = Template()
    template = template.skip_cache().from_gcp_registry(
        "gcr.io/nonexistent-project/nonexistent:latest",
        service_account_json={
            "type": "service_account",
        },
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "from_gcp_registry")


@pytest.mark.skip_debug()
def test_traces_on_copy(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().copy(non_existent_path, non_existent_path)
    _expect_to_throw_and_check_trace(lambda: build(template), "copy")


@pytest.mark.skip_debug()
def test_traces_on_copyItems(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().copy_items([CopyItem(src=non_existent_path, dest=non_existent_path)])
    _expect_to_throw_and_check_trace(lambda: build(template), "copy_items")


@pytest.mark.skip_debug()
def test_traces_on_remove(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().remove(non_existent_path)
    _expect_to_throw_and_check_trace(lambda: build(template), "remove")


@pytest.mark.skip_debug()
def test_traces_on_rename(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().rename(non_existent_path, "/tmp/dest.txt")
    _expect_to_throw_and_check_trace(lambda: build(template), "rename")


@pytest.mark.skip_debug()
def test_traces_on_make_dir(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().make_dir(".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "make_dir")


@pytest.mark.skip_debug()
def test_traces_on_make_symlink(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().make_symlink(".bashrc", ".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "make_symlink")


@pytest.mark.skip_debug()
def test_traces_on_run_cmd(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().run_cmd(f"cat {non_existent_path}")
    _expect_to_throw_and_check_trace(lambda: build(template), "run_cmd")


@pytest.mark.skip_debug()
def test_traces_on_set_workdir(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().set_workdir(".bashrc")
    _expect_to_throw_and_check_trace(lambda: build(template), "set_workdir")


@pytest.mark.skip_debug()
def test_traces_on_set_user(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().set_user(";")
    _expect_to_throw_and_check_trace(lambda: build(template), "set_user")


@pytest.mark.skip_debug()
def test_traces_on_pip_install(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().pip_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "pip_install")


@pytest.mark.skip_debug()
def test_traces_on_npm_install(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().npm_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "npm_install")


@pytest.mark.skip_debug()
def test_traces_on_apt_install(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().apt_install("nonexistent-package")
    _expect_to_throw_and_check_trace(lambda: build(template), "apt_install")


@pytest.mark.skip_debug()
def test_traces_on_git_clone(build):
    template = Template()
    template = template.from_base_image()
    template = template.skip_cache().git_clone("https://github.com/repo.git")
    _expect_to_throw_and_check_trace(lambda: build(template), "git_clone")


@pytest.mark.skip_debug()
def test_traces_on_start_cmd(build):
    template = Template()
    template = template.from_base_image()
    template = template.set_start_cmd(
        f"./{non_existent_path}", wait_for_timeout(10_000)
    )
    _expect_to_throw_and_check_trace(lambda: build(template), "set_start_cmd")
