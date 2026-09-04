"""In-memory mock of the volume content API (spec/openapi-volumecontent.yml).

Backs the `volume`/`async_volume` fixtures so volume file-operation tests run
against a stateful in-process filesystem instead of a live volume server.
"""

import json
import posixpath
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx

from e2b.volume.types import VolumeFileType

DEFAULT_FILE_MODE = 0o644
DEFAULT_DIR_MODE = 0o755


@dataclass
class _Entry:
    name: str
    type: VolumeFileType
    path: str
    uid: int = 0
    gid: int = 0
    mode: int = 0
    content: bytes = b""
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def stat(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "path": self.path,
            "size": len(self.content),
            "mode": self.mode,
            "uid": self.uid,
            "gid": self.gid,
            "atime": self.timestamp,
            "mtime": self.timestamp,
            "ctime": self.timestamp,
        }


def _normalize(path: str) -> str:
    path = path.strip()
    if not path.startswith("/"):
        path = "/" + path
    return posixpath.normpath(path)


def _error(status: int, message: str) -> httpx.Response:
    return httpx.Response(
        status,
        content=json.dumps({"code": str(status), "message": message}).encode(),
        headers={"Content-Type": "application/json"},
    )


class MockVolumeContentAPI:
    """A per-test, in-memory volume filesystem behind an httpx.MockTransport."""

    def __init__(self):
        self.entries: Dict[str, _Entry] = {
            "/": _Entry(
                name="/",
                type=VolumeFileType.DIRECTORY,
                path="/",
                mode=DEFAULT_DIR_MODE,
            )
        }

    def handler(self, request: httpx.Request) -> httpx.Response:
        request.read()
        return self._handle(request)

    async def async_handler(self, request: httpx.Request) -> httpx.Response:
        await request.aread()
        return self._handle(request)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        segments = request.url.path.strip("/").split("/")
        if len(segments) != 3 or segments[0] != "volumecontent":
            return _error(404, "Not found")
        resource = segments[2]
        params = request.url.params
        path = _normalize(params.get("path") or "")

        if resource == "file":
            if request.method == "GET":
                return self._read_file(path)
            if request.method == "PUT":
                return self._write_file(path, params, request.content)
        elif resource == "dir":
            if request.method == "GET":
                return self._list_dir(path)
            if request.method == "POST":
                return self._make_dir(path, params)
        elif resource == "path":
            if request.method == "GET":
                return self._stat(path)
            if request.method == "PATCH":
                return self._update_metadata(path, request.content)
            if request.method == "DELETE":
                return self._remove(path)

        return _error(404, "Not found")

    @staticmethod
    def _int_param(params: httpx.QueryParams, name: str) -> Optional[int]:
        value = params.get(name)
        return int(value) if value is not None else None

    @classmethod
    def _mode_param(cls, params: httpx.QueryParams, default: int) -> int:
        mode = cls._int_param(params, "mode")
        return mode if mode is not None else default

    @staticmethod
    def _bool_param(params: httpx.QueryParams, name: str) -> bool:
        return (params.get(name) or "").lower() == "true"

    def _read_file(self, path: str) -> httpx.Response:
        entry = self.entries.get(path)
        if entry is None or entry.type != VolumeFileType.FILE:
            return _error(404, f"Path {path} not found")
        return httpx.Response(
            200,
            content=entry.content,
            headers={"Content-Type": "application/octet-stream"},
        )

    def _write_file(
        self, path: str, params: httpx.QueryParams, content: bytes
    ) -> httpx.Response:
        existing = self.entries.get(path)
        if existing is not None:
            if existing.type != VolumeFileType.FILE:
                return _error(409, f"Path {path} is a directory")
            if not self._bool_param(params, "force"):
                return _error(409, f"Path {path} already exists")

        parent = self.entries.get(posixpath.dirname(path))
        if parent is None or parent.type != VolumeFileType.DIRECTORY:
            return _error(404, f"Path {path} not found")

        entry = _Entry(
            name=posixpath.basename(path),
            type=VolumeFileType.FILE,
            path=path,
            uid=self._int_param(params, "uid") or 0,
            gid=self._int_param(params, "gid") or 0,
            mode=self._mode_param(params, DEFAULT_FILE_MODE),
            content=content,
        )
        self.entries[path] = entry
        return httpx.Response(201, json=entry.stat())

    def _make_dir(self, path: str, params: httpx.QueryParams) -> httpx.Response:
        force = self._bool_param(params, "force")
        existing = self.entries.get(path)
        if existing is not None:
            if not force or existing.type != VolumeFileType.DIRECTORY:
                return _error(409, f"Path {path} already exists")
            return httpx.Response(201, json=existing.stat())

        parent_path = posixpath.dirname(path)
        parent = self.entries.get(parent_path)
        if parent is None:
            if not force:
                return _error(404, f"Path {parent_path} not found")
            res = self._make_dir(parent_path, params)
            if res.status_code >= 400:
                return res
        elif parent.type != VolumeFileType.DIRECTORY:
            return _error(409, f"Path {parent_path} is not a directory")

        entry = _Entry(
            name=posixpath.basename(path),
            type=VolumeFileType.DIRECTORY,
            path=path,
            uid=self._int_param(params, "uid") or 0,
            gid=self._int_param(params, "gid") or 0,
            mode=self._mode_param(params, DEFAULT_DIR_MODE),
        )
        self.entries[path] = entry
        return httpx.Response(201, json=entry.stat())

    def _list_dir(self, path: str) -> httpx.Response:
        entry = self.entries.get(path)
        if entry is None or entry.type != VolumeFileType.DIRECTORY:
            return _error(404, f"Path {path} not found")
        prefix = "/" if path == "/" else path + "/"
        children = [
            e.stat()
            for p, e in self.entries.items()
            if p != path and p.startswith(prefix) and "/" not in p[len(prefix) :]
        ]
        return httpx.Response(200, json=children)

    def _stat(self, path: str) -> httpx.Response:
        entry = self.entries.get(path)
        if entry is None:
            return _error(404, f"Path {path} not found")
        return httpx.Response(200, json=entry.stat())

    def _update_metadata(self, path: str, content: bytes) -> httpx.Response:
        entry = self.entries.get(path)
        if entry is None:
            return _error(404, f"Path {path} not found")
        body = json.loads(content or b"{}")
        if body.get("uid") is not None:
            entry.uid = body["uid"]
        if body.get("gid") is not None:
            entry.gid = body["gid"]
        if body.get("mode") is not None:
            entry.mode = body["mode"]
        return httpx.Response(200, json=entry.stat())

    def _remove(self, path: str) -> httpx.Response:
        if path == "/" or path not in self.entries:
            return _error(404, f"Path {path} not found")
        prefix = path + "/"
        for p in list(self.entries):
            if p == path or p.startswith(prefix):
                del self.entries[p]
        return httpx.Response(204)
