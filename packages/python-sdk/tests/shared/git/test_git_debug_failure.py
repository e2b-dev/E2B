import os
import subprocess

import pytest

from e2b import CommandExitException


if os.getenv("E2B_DEBUG_GIT_FAILURE") is None:
    pytest.skip(
        "Set E2B_DEBUG_GIT_FAILURE=1 to run debug-only git failure tests.",
        allow_module_level=True,
    )


CONTAINER_NAME = os.getenv("E2B_DEBUG_ENVD_CONTAINER", "envd")
GIT_PATH = "/usr/bin/git"
GIT_BACKUP_PATH = "/usr/bin/git.__e2b_backup__"
REPO_PATH = "/tmp/e2b-git-debug-repo"


def docker_exec(command: str) -> str:
    return subprocess.check_output(
        ["docker", "exec", CONTAINER_NAME, "/bin/bash", "-lc", command],
        text=True,
    )


def can_exec_in_container() -> bool:
    try:
        docker_exec("true")
        return True
    except Exception:
        return False


def is_git_available() -> bool:
    result = docker_exec(
        "if command -v git >/dev/null 2>&1; then echo found; else echo missing; fi"
    ).strip()
    return result == "found"


def hide_git_binary() -> None:
    docker_exec(
        f'if [ -x "{GIT_PATH}" ] && [ ! -e "{GIT_BACKUP_PATH}" ]; then mv "{GIT_PATH}" "{GIT_BACKUP_PATH}"; fi'
    )


def restore_git_binary() -> None:
    docker_exec(
        f'if [ -e "{GIT_BACKUP_PATH}" ]; then mv "{GIT_BACKUP_PATH}" "{GIT_PATH}"; fi'
    )


def test_git_missing_surfaces_command_exit_error(sandbox_factory):
    if not can_exec_in_container():
        pytest.skip(f"Container '{CONTAINER_NAME}' is not available.")

    if not is_git_available():
        pytest.skip("git is already missing in the debug container.")

    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    sandbox.commands.run(
        f'rm -rf "{REPO_PATH}" && mkdir -p "{REPO_PATH}" && git -C "{REPO_PATH}" init'
    )

    hide_git_binary()
    assert not is_git_available(), "expected git to be unavailable"

    caught: CommandExitException | None = None
    try:
        sandbox.git.status(REPO_PATH)
    except CommandExitException as err:
        caught = err
    finally:
        restore_git_binary()

    assert is_git_available(), "expected git to be restored"
    assert caught is not None, "expected git.status to raise CommandExitException"
    assert caught.exit_code != 0
    assert "command not found" in caught.stderr.lower()

