import math

import pytest

from e2b import (
    InvalidArgumentException,
    Template,
    wait_for_port,
    wait_for_timeout,
    wait_for_url,
)
from sdk_flavours import result

# Arguments the builder writes into a shell command before the API sees them.
# `Template.to_dockerfile` shows the command each method produced.


def _base():
    return Template().from_image("ubuntu:22.04")


def _run_lines(template):
    return [
        line
        for line in Template.to_dockerfile(template).split("\n")
        if line.startswith("RUN ")
    ]


@pytest.mark.parametrize(
    ("method", "command"),
    [
        ("pip_install", "RUN pip install"),
        ("npm_install", "RUN npm install"),
        ("bun_install", "RUN bun install"),
    ],
)
def test_install_quotes_a_version_range_the_shell_would_read_as_a_redirect(
    method, command
):
    template = getattr(_base(), method)(["left>=2", "right<3", "plain==1.0"])

    assert _run_lines(template) == [f"{command} 'left>=2' 'right<3' plain==1.0"]


def test_apt_install_quotes_a_version_range():
    template = _base().apt_install(["curl", "libfoo>=2"])

    assert _run_lines(template)[-1].endswith(" install -y curl 'libfoo>=2'")


@pytest.mark.parametrize(
    ("given", "written"),
    [
        ("numpy!=1.5,<2", "'numpy!=1.5,<2'"),
        ("numpy;reboot", "'numpy;reboot'"),
        ("numpy|sh", "'numpy|sh'"),
    ],
)
def test_pip_install_quotes_what_the_shell_would_split(given, written):
    assert _run_lines(_base().pip_install(given)) == [f"RUN pip install {written}"]


# Only an argument the shell would split or redirect is rewritten, so the
# command of a template that builds today, and with it its cache, is kept.
@pytest.mark.parametrize(
    "given",
    [
        "requests[socks]",
        "torch==2.*",
        "numpy~=1.26",
        "@scope/pkg@^1.2.0",
        "-r requirements.txt",
        '"numpy>=2"',
        "numpy; python_version<'3.9'",
        "$PACKAGE",
        "numpy",
    ],
)
def test_pip_install_writes_other_arguments_as_given(given):
    assert _run_lines(_base().pip_install(given)) == [f"RUN pip install {given}"]


NO_MODE = [-1, 0o10000, 755.5, "755", True]


@pytest.mark.parametrize("mode", NO_MODE)
def test_copy_refuses_what_is_no_mode(mode):
    with pytest.raises(InvalidArgumentException, match="mode"):
        _base().copy("file.txt", "/app/", mode=mode)


@pytest.mark.parametrize("mode", NO_MODE)
def test_make_dir_refuses_what_is_no_mode(mode):
    with pytest.raises(InvalidArgumentException, match="mode"):
        _base().make_dir("/app", mode=mode)


def test_make_dir_writes_the_mode_in_octal():
    assert _run_lines(_base().make_dir("/app", mode=0o755)) == [
        "RUN mkdir -p -m 0755 /app"
    ]


@pytest.mark.parametrize("depth", [-1, 1.5, "1; rm -rf /", True])
def test_git_clone_refuses_what_is_no_depth(depth):
    with pytest.raises(InvalidArgumentException, match="depth"):
        _base().git_clone("https://example.com/repo.git", depth=depth)


def test_git_clone_writes_a_positive_depth():
    template = _base().git_clone("https://example.com/repo.git", "/repo", depth=1)

    assert _run_lines(template) == [
        "RUN git clone https://example.com/repo.git --depth 1 /repo"
    ]


@pytest.mark.parametrize("port", [0, 65536, 80.5, "80; reboot", True])
def test_wait_for_port_refuses_what_is_no_port(port):
    with pytest.raises(InvalidArgumentException, match="port"):
        wait_for_port(port)


@pytest.mark.parametrize("status_code", [20, 1000, 200.5, "200"])
def test_wait_for_url_refuses_what_is_no_status_code(status_code):
    with pytest.raises(InvalidArgumentException, match="status_code"):
        wait_for_url("http://localhost:3000", status_code)


@pytest.mark.parametrize("timeout", [math.nan, -1, math.inf, "5000", True])
def test_wait_for_timeout_refuses_what_is_no_duration(timeout):
    with pytest.raises(InvalidArgumentException, match="timeout"):
        wait_for_timeout(timeout)


async def test_build_with_request_timeout_zero_uploads_without_a_timeout(
    sdk, backend, opts, tmp_path
):
    # `0` disables the timeout for every request; for the upload of a copied
    # file it used to be a timeout of zero seconds.
    (tmp_path / "hello.txt").write_text("hello world")
    backend.reply(
        "POST",
        "/v3/templates",
        202,
        {
            "templateID": "tpl",
            "buildID": "bld",
            "public": False,
            "names": ["name"],
            "tags": [],
            "aliases": ["name"],
        },
    )
    backend.reply(
        "GET",
        "/templates/tpl/files/",
        201,
        {"present": False, "url": f"{backend.url}/upload"},
    )
    backend.reply("PUT", "/upload", 200)
    backend.reply("POST", "/v2/templates/tpl/builds/bld", 202)
    backend.reply(
        "GET",
        "/templates/tpl/builds/bld/status",
        200,
        {
            "templateID": "tpl",
            "buildID": "bld",
            "status": "ready",
            "logs": [],
            "logEntries": [],
        },
    )
    template = (
        sdk.Template(file_context_path=tmp_path)
        .from_image("ubuntu:22.04")
        .copy("hello.txt", "/app/")
    )

    await result(sdk.Template.build(template, "name", request_timeout=0, **opts))

    assert "PUT /upload" in backend.sent
