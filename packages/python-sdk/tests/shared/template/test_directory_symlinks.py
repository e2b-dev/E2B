import io
import json
import sys
import tarfile
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from e2b import AsyncTemplate, Template
from e2b.exceptions import BuildException


@pytest.fixture
def build_endpoint():
    """Replace only the remote build API and inspect the uploaded archive."""
    uploads = []
    hashes = []

    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if self.path == "/v3/templates":
                self.reply(
                    202,
                    {
                        "templateID": "fixture",
                        "buildID": "build",
                        "public": False,
                        "names": [],
                        "tags": [],
                        "aliases": [],
                    },
                )
            elif self.path == "/v2/templates/fixture/builds/build":
                self.reply(202, {})
            else:
                self.reply(404, {})

        def do_GET(self):
            if not self.path.startswith("/templates/fixture/files/"):
                self.reply(404, {})
                return
            hashes.append(self.path.rsplit("/", 1)[-1])
            self.reply(
                201,
                {
                    "present": False,
                    "url": f"http://127.0.0.1:{server.server_port}/upload",
                },
            )

        def do_PUT(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            with tarfile.open(fileobj=io.BytesIO(body), mode="r:*") as archive:
                members = {}
                for entry in archive.getmembers():
                    contents = None
                    if entry.isfile():
                        file = archive.extractfile(entry)
                        assert file is not None
                        with file:
                            contents = file.read()
                    members[entry.name.rstrip("/")] = (entry.type, contents)
                uploads.append(members)
            self.reply(200, {})

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", uploads, hashes
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
@pytest.mark.parametrize("resolve", [True, False])
async def test_build_directory_symlink_contents(
    tmp_path, build_endpoint, template_class, resolve
):
    (tmp_path / "real").mkdir()
    (tmp_path / "real" / "app.py").write_text("print('hello')")
    (tmp_path / "linked").symlink_to("real", target_is_directory=True)
    endpoint, uploads, _ = build_endpoint
    template = (
        template_class(file_context_path=tmp_path)
        .from_python_image("3")
        .copy(
            "linked",
            "/app",
            resolve_symlinks=resolve,
        )
    )
    result = template_class.build_in_background(
        template,
        "fixture",
        api_key="fixture-placeholder",
        api_url=endpoint,
    )
    if template_class is AsyncTemplate:
        await result

    if resolve:
        assert uploads[-1] == {
            "linked": (tarfile.DIRTYPE, None),
            "linked/app.py": (tarfile.REGTYPE, b"print('hello')"),
        }
    else:
        assert uploads[-1] == {"linked": (tarfile.SYMTYPE, None)}


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
@pytest.mark.parametrize("source", ["linked", "real"])
async def test_build_resolved_links_hash_contents_and_apply_ignores(
    tmp_path,
    build_endpoint,
    template_class,
    source,
):
    (tmp_path / "real").mkdir()
    (tmp_path / "other").mkdir()
    target = tmp_path / "other" / "app.py"
    target.write_text("first")
    secret = tmp_path / "other" / ".env"
    secret.write_text("synthetic-secret")
    (tmp_path / "linked").symlink_to("real", target_is_directory=True)
    for name in ["nested", "again"]:
        (tmp_path / "real" / name).symlink_to("../other", target_is_directory=True)
    endpoint, uploads, hashes = build_endpoint

    async def build():
        template = (
            template_class(
                file_context_path=tmp_path,
                file_ignore_patterns=[f"{source}/nested/.env", f"{source}/again/.env"],
            )
            .from_python_image("3")
            .copy(source, "/app", resolve_symlinks=True)
        )
        result = template_class.build_in_background(
            template,
            "fixture",
            api_key="fixture-placeholder",
            api_url=endpoint,
        )
        if template_class is AsyncTemplate:
            await result

    await build()
    assert uploads[-1][f"{source}/nested/app.py"] == (tarfile.REGTYPE, b"first")
    assert uploads[-1][f"{source}/again/app.py"] == (tarfile.REGTYPE, b"first")
    assert not any(name.endswith(".env") for name in uploads[-1])
    secret.write_text("a-longer-synthetic-secret")
    await build()
    assert hashes[-1] == hashes[-2]
    target.write_text("other")
    await build()
    assert hashes[-1] != hashes[-2]
    assert uploads[-1][f"{source}/nested/app.py"] == (tarfile.REGTYPE, b"other")


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
async def test_build_reports_cyclic_directory_symlinks(
    tmp_path, build_endpoint, template_class
):
    (tmp_path / "real").mkdir()
    (tmp_path / "real" / "back").symlink_to(".", target_is_directory=True)
    endpoint, _, _ = build_endpoint
    template = (
        template_class(file_context_path=tmp_path)
        .from_python_image("3")
        .copy(
            "real",
            "/app",
            resolve_symlinks=True,
        )
    )
    with pytest.raises(BuildException, match="cyclic directory symlink"):
        result = template_class.build_in_background(
            template,
            "fixture",
            api_key="fixture-placeholder",
            api_url=endpoint,
        )
        if template_class is AsyncTemplate:
            await result


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
async def test_build_detects_cycles_through_ignored_ancestors(
    tmp_path, build_endpoint, template_class
):
    (tmp_path / "real" / "ignored").mkdir(parents=True)
    (tmp_path / "real" / "ignored" / "back").symlink_to("..", target_is_directory=True)
    endpoint, _, _ = build_endpoint
    template = (
        template_class(
            file_context_path=tmp_path,
            file_ignore_patterns=["**/ignored", "!**/back"],
        )
        .from_python_image("3")
        .copy("real", "/app", resolve_symlinks=True)
    )
    with pytest.raises(BuildException, match="cyclic directory symlink"):
        result = template_class.build_in_background(
            template,
            "fixture",
            api_key="fixture-placeholder",
            api_url=endpoint,
        )
        if template_class is AsyncTemplate:
            await result


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
@pytest.mark.parametrize("case", ["reinclusion", "literal"])
async def test_build_link_names_and_reincluded_children(
    tmp_path, build_endpoint, template_class, case
):
    (tmp_path / "real").mkdir()
    if case == "reinclusion":
        (tmp_path / "target").mkdir()
        (tmp_path / "target" / "keep.txt").write_text("keep")
        (tmp_path / "target" / "skip.txt").write_text("skip")
        (tmp_path / "real" / "link").symlink_to("../target", target_is_directory=True)
        source = "."
        ignores = ["target", "real/link", "!real/link/keep.txt"]
    else:
        (tmp_path / "alias1").mkdir()
        (tmp_path / "real" / "app.py").write_text("correct")
        (tmp_path / "alias1" / "wrong.txt").write_text("other directory")
        (tmp_path / "alias[1]").symlink_to("real", target_is_directory=True)
        source = "*"
        ignores = []
    endpoint, uploads, hashes = build_endpoint

    async def build():
        template = (
            template_class(file_context_path=tmp_path, file_ignore_patterns=ignores)
            .from_python_image("3")
            .copy(source, "/app", resolve_symlinks=True)
        )
        result = template_class.build_in_background(
            template, "fixture", api_key="fixture-placeholder", api_url=endpoint
        )
        if template_class is AsyncTemplate:
            await result

    await build()
    if case == "reinclusion":
        assert uploads[-1]["real/link/keep.txt"] == (tarfile.REGTYPE, b"keep")
        assert "real/link" not in uploads[-1]
        assert "real/link/skip.txt" not in uploads[-1]
        (tmp_path / "target" / "keep.txt").write_text("edit")
        await build()
        assert hashes[-1] != hashes[-2]
        (tmp_path / "target" / "skip.txt").write_text("ignored edit")
        await build()
        assert hashes[-1] == hashes[-2]
    else:
        assert uploads[-1]["alias[1]/app.py"] == (tarfile.REGTYPE, b"correct")
        assert "alias[1]/wrong.txt" not in uploads[-1]


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
@pytest.mark.parametrize("resolve", [True, False])
@pytest.mark.parametrize("target_kind", ["directory", "nested_file"])
async def test_build_resolved_directory_links_stay_in_context(
    tmp_path,
    tmp_path_factory,
    build_endpoint,
    template_class,
    resolve,
    target_kind,
):
    outside = tmp_path_factory.mktemp("outside-link-target")
    (outside / "synthetic.txt").write_text("outside fixture")
    if target_kind == "directory":
        (tmp_path / "linked").symlink_to(outside, target_is_directory=True)
    else:
        (tmp_path / "real").mkdir()
        (tmp_path / "real" / "external.txt").symlink_to(outside / "synthetic.txt")
        (tmp_path / "linked").symlink_to("real", target_is_directory=True)
    endpoint, uploads, _ = build_endpoint
    template = (
        template_class(file_context_path=tmp_path)
        .from_python_image("3")
        .copy(
            "linked",
            "/app",
            resolve_symlinks=resolve,
        )
    )

    async def build():
        result = template_class.build_in_background(
            template,
            "fixture",
            api_key="fixture-placeholder",
            api_url=endpoint,
        )
        if template_class is AsyncTemplate:
            await result

    if resolve:
        with pytest.raises(BuildException, match="outside.*context"):
            await build()
        assert not uploads
    else:
        await build()
        assert uploads[-1] == {"linked": (tarfile.SYMTYPE, None)}


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
async def test_build_link_error_preserves_copy_callsite(
    tmp_path, build_endpoint, template_class
):
    (tmp_path / "real").mkdir()
    (tmp_path / "real" / "back").symlink_to(".", target_is_directory=True)
    endpoint, _, _ = build_endpoint

    def copy_with_cyclic_link():
        return (
            template_class(file_context_path=tmp_path)
            .from_python_image("3")
            .copy(
                "real",
                "/app",
                resolve_symlinks=True,
            )
        )

    template = copy_with_cyclic_link()
    with pytest.raises(BuildException, match="resolve_symlinks=False") as failure:
        result = template_class.build_in_background(
            template, "fixture", api_key="fixture-placeholder", api_url=endpoint
        )
        if template_class is AsyncTemplate:
            await result
    assert any(
        frame.name == "copy_with_cyclic_link"
        for frame in traceback.extract_tb(failure.value.__traceback__)
    )


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
async def test_build_ignores_excluded_self_referential_link(
    tmp_path, build_endpoint, template_class
):
    (tmp_path / "app.py").write_text("selected")
    (tmp_path / "loop").symlink_to("loop")
    endpoint, uploads, _ = build_endpoint
    template = (
        template_class(file_context_path=tmp_path, file_ignore_patterns=["loop"])
        .from_python_image("3")
        .copy(".", "/app", resolve_symlinks=True)
    )
    result = template_class.build_in_background(
        template, "fixture", api_key="fixture-placeholder", api_url=endpoint
    )
    if template_class is AsyncTemplate:
        await result
    assert uploads[-1]["app.py"] == (tarfile.REGTYPE, b"selected")
    assert "loop" not in uploads[-1]


@pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require privileges")
@pytest.mark.asyncio
@pytest.mark.parametrize("template_class", [Template, AsyncTemplate])
@pytest.mark.parametrize("resolve", [True, False])
async def test_build_selects_only_source_under_linked_context(
    tmp_path, tmp_path_factory, build_endpoint, template_class, resolve
):
    (tmp_path / "app.py").write_text("selected")
    (tmp_path / "unselected.txt").write_text("not selected")
    alias = tmp_path_factory.mktemp("context-alias") / "context"
    alias.symlink_to(tmp_path, target_is_directory=True)
    endpoint, uploads, _ = build_endpoint
    template = (
        template_class(file_context_path=alias)
        .from_python_image("3")
        .copy("app.py", "/app", resolve_symlinks=resolve)
    )
    result = template_class.build_in_background(
        template, "fixture", api_key="fixture-placeholder", api_url=endpoint
    )
    if template_class is AsyncTemplate:
        await result
    assert uploads[-1] == {"app.py": (tarfile.REGTYPE, b"selected")}
