"""Public Git status parsing over native Git output and the real RPC codec."""

import base64
import json
import os
import struct
import subprocess

import pytest
from pyqwest import Headers, Response, SyncResponse

from e2b import AsyncSandbox, Sandbox
import e2b.envd.client_sync as sync_client
import e2b.envd.client_async as async_client

pytestmark = pytest.mark.skipif(
    os.name == "nt", reason="Native Git index fixture requires Unix"
)

UNMERGED = [
    ([1], "DD"),
    ([2], "AU"),
    ([1, 2], "UD"),
    ([3], "UA"),
    ([1, 3], "DU"),
    ([2, 3], "AA"),
    ([1, 2, 3], "UU"),
]


def native_status(path, stages):
    def git(*args, input=None, check=True):
        return subprocess.run(
            [
                "git",
                "-C",
                str(path),
                "-c",
                "user.name=Local test",
                "-c",
                "user.email=local@example.invalid",
                "-c",
                "commit.gpgsign=false",
                "-c",
                "core.hooksPath=/dev/null",
                *args,
            ],
            input=input,
            text=True,
            capture_output=True,
            check=check,
        )

    git("init", "-q")
    if stages in ([1], [2, 3]):
        # Real rename/rename and add/add merges produce the two codes that
        # contain no U. No handwritten status output or parser helper is used.
        if stages == [1]:
            (path / "conflict.txt").write_text("content\n")
            git("add", "conflict.txt")
        git("commit", "--allow-empty", "-qm", "base")
        git("checkout", "-qb", "ours")
        if stages == [1]:
            git("mv", "conflict.txt", "ours.txt")
        else:
            (path / "conflict.txt").write_text("ours\n")
            git("add", "conflict.txt")
        git("commit", "-qm", "ours")
        git("checkout", "-qb", "theirs", "HEAD~1")
        if stages == [1]:
            git("mv", "conflict.txt", "theirs.txt")
        else:
            (path / "conflict.txt").write_text("theirs\n")
            git("add", "conflict.txt")
        git("commit", "-qm", "theirs")
        result = git("merge", "--no-edit", "ours", check=False)
        assert result.returncode == 1, result.stdout + result.stderr
    else:
        # The remaining legal unmerged states are represented by Git's native
        # index stages, and Git itself renders their porcelain codes.
        entries = []
        for stage in stages:
            blob = git(
                "hash-object", "-w", "--stdin", input=f"stage {stage}\n"
            ).stdout.strip()
            entries.append(f"100644 {blob} {stage}\tconflict.txt\n")
        git("update-index", "--index-info", input="".join(entries))
        (path / "conflict.txt").write_text("content\n")
    return git("status", "--porcelain=1", "-b").stdout


def install_envd_output(monkeypatch, output):
    def envelope(value, flag=0):
        data = json.dumps(value).encode()
        return struct.pack(">BI", flag, len(data)) + data

    body = b"".join(
        [
            envelope({"event": {"start": {"pid": 42}}}),
            envelope(
                {
                    "event": {
                        "data": {"stdout": base64.b64encode(output.encode()).decode()}
                    }
                }
            ),
            envelope(
                {"event": {"end": {"exitCode": 0, "exited": True, "status": "exited"}}}
            ),
            envelope({}, 2),
        ]
    )

    class ProcessTransport:
        def execute_sync(self, request):
            if not isinstance(request.content, bytes):
                b"".join(request.content)
            return SyncResponse(
                status=200,
                headers=Headers({"content-type": "application/connect+json"}),
                content=body,
            )

        async def execute(self, request):
            if not isinstance(request.content, bytes):
                async for _chunk in request.content:
                    pass
            return Response(
                status=200,
                headers=Headers({"content-type": "application/connect+json"}),
                content=body,
            )

    # Only the HTTP transport is replaced: generated clients, Commands,
    # command handles, Git command construction and status parsing stay real.
    monkeypatch.setattr(
        sync_client,
        "get_pyqwest_transport",
        lambda *_args, **_kwargs: ProcessTransport(),
    )
    monkeypatch.setattr(
        async_client,
        "get_pyqwest_transport",
        lambda *_args, **_kwargs: ProcessTransport(),
    )


@pytest.mark.parametrize("stages,code", UNMERGED)
def test_sync_git_reports_unresolved_conflicts(tmp_path, monkeypatch, stages, code):
    output = native_status(tmp_path, stages)
    assert f"{code} conflict.txt" in output
    install_envd_output(monkeypatch, output)
    sandbox = Sandbox.connect("offline-sandbox", debug=True)
    status = sandbox.git.status(str(tmp_path))
    assert (
        next(item for item in status.file_status if item.name == "conflict.txt").status
        == "conflict"
    )
    assert status.has_conflicts
    assert status.conflict_count == (3 if code == "DD" else 1)
    assert status.total_count == (3 if code == "DD" else 1)


@pytest.mark.parametrize("stages,code", UNMERGED)
async def test_async_git_reports_unresolved_conflicts(
    tmp_path, monkeypatch, stages, code
):
    output = native_status(tmp_path, stages)
    assert f"{code} conflict.txt" in output
    install_envd_output(monkeypatch, output)
    sandbox = await AsyncSandbox.connect("offline-sandbox", debug=True)
    status = await sandbox.git.status(str(tmp_path))
    assert (
        next(item for item in status.file_status if item.name == "conflict.txt").status
        == "conflict"
    )
    assert status.has_conflicts
    assert status.conflict_count == (3 if code == "DD" else 1)
    assert status.total_count == (3 if code == "DD" else 1)


ORDINARY = [
    ("A ", "added"),
    (" D", "deleted"),
    ("AM", "added"),
    ("MD", "deleted"),
    ("??", "untracked"),
]


@pytest.mark.parametrize("code,expected", ORDINARY)
def test_sync_git_keeps_ordinary_changes(monkeypatch, code, expected):
    install_envd_output(monkeypatch, f"## main\n{code} change.txt\n")
    status = Sandbox.connect("offline-sandbox", debug=True).git.status("/repo")
    assert status.file_status[0].status == expected
    assert not status.has_conflicts
    assert status.conflict_count == 0


@pytest.mark.parametrize("code,expected", ORDINARY)
async def test_async_git_keeps_ordinary_changes(monkeypatch, code, expected):
    install_envd_output(monkeypatch, f"## main\n{code} change.txt\n")
    sandbox = await AsyncSandbox.connect("offline-sandbox", debug=True)
    status = await sandbox.git.status("/repo")
    assert status.file_status[0].status == expected
    assert not status.has_conflicts
    assert status.conflict_count == 0
