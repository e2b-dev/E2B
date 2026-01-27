import os

import pytest


if os.getenv("E2B_DEBUG_GIT_INIT") is None:
    pytest.skip(
        "Set E2B_DEBUG_GIT_INIT=1 to run debug-only git init tests.",
        allow_module_level=True,
    )


INITIAL_BRANCH = "main"
REPO_PATH_INIT = "/tmp/e2b-git-init-repo-init"
REPO_PATH_CREATE = "/tmp/e2b-git-init-repo-create"


def _assert_repo_initialized(sandbox, repo_path: str, init_fn) -> None:
    sandbox.commands.run(f'rm -rf "{repo_path}"')

    try:
        init_fn()

        repo_check = sandbox.commands.run(
            f'if [ -d "{repo_path}/.git" ]; then echo found; else echo missing; fi'
        ).stdout.strip()
        assert repo_check == "found"

        branch_check = sandbox.commands.run(
            f'git -C "{repo_path}" symbolic-ref --short HEAD'
        ).stdout.strip()
        assert branch_check == INITIAL_BRANCH
    finally:
        sandbox.commands.run(f'rm -rf "{repo_path}"')


def test_git_init_initializes_repo_with_initial_branch(sandbox_factory):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    _assert_repo_initialized(
        sandbox,
        REPO_PATH_INIT,
        lambda: sandbox.git.init(REPO_PATH_INIT, initial_branch=INITIAL_BRANCH),
    )


def test_create_repo_initializes_repo_with_initial_branch(sandbox_factory):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    _assert_repo_initialized(
        sandbox,
        REPO_PATH_CREATE,
        lambda: sandbox.git.create_repo(
            REPO_PATH_CREATE, initial_branch=INITIAL_BRANCH
        ),
    )
