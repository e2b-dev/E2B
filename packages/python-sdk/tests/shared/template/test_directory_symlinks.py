import io
import json
import sys
import tarfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from e2b import AsyncTemplate, Template
from e2b.exceptions import TemplateException


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
    with pytest.raises(TemplateException, match="cyclic directory symlink"):
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
    with pytest.raises(TemplateException, match="cyclic directory symlink"):
        result = template_class.build_in_background(
            template,
            "fixture",
            api_key="fixture-placeholder",
            api_url=endpoint,
        )
        if template_class is AsyncTemplate:
            await result
