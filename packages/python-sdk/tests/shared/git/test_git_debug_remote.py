import os

import pytest


if os.getenv("E2B_DEBUG_GIT_REMOTE") is None:
    pytest.skip(
        "Set E2B_DEBUG_GIT_REMOTE=1 to run debug-only git remote tests.",
        allow_module_level=True,
    )


REPO_PATH = "/tmp/e2b-git-remote-repo"
REMOTE_NAME = "origin"
FIRST_URL = "https://example.com/first.git"
SECOND_URL = "https://example.com/second.git"


def _get_remote_url(sandbox, repo_path: str, remote_name: str) -> str:
    return sandbox.commands.run(
        f'git -C "{repo_path}" remote get-url {remote_name}'
    ).stdout.strip()


def test_remote_add_sets_and_overwrites_remote_url(sandbox_factory):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    sandbox.commands.run(f'rm -rf "{REPO_PATH}"')

    try:
        sandbox.git.init(REPO_PATH, initial_branch="main")

        sandbox.git.remote_add(REPO_PATH, REMOTE_NAME, FIRST_URL)
        assert _get_remote_url(sandbox, REPO_PATH, REMOTE_NAME) == FIRST_URL

        sandbox.git.remote_add(
            REPO_PATH,
            REMOTE_NAME,
            SECOND_URL,
            overwrite=True,
        )
        assert _get_remote_url(sandbox, REPO_PATH, REMOTE_NAME) == SECOND_URL
    finally:
        sandbox.commands.run(f'rm -rf "{REPO_PATH}"')
