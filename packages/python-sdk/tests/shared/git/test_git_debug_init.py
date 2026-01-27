import os

import pytest


if os.getenv("E2B_DEBUG_GIT_INIT") is None:
    pytest.skip(
        "Set E2B_DEBUG_GIT_INIT=1 to run debug-only git init tests.",
        allow_module_level=True,
    )


REPO_PATH = "/tmp/e2b-git-init-repo"
INITIAL_BRANCH = "main"


def test_git_init_creates_repo_with_initial_branch(sandbox_factory):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    sandbox.commands.run(f'rm -rf "{REPO_PATH}"')

    try:
        sandbox.git.init(REPO_PATH, initial_branch=INITIAL_BRANCH)

        repo_check = sandbox.commands.run(
            f'if [ -d "{REPO_PATH}/.git" ]; then echo found; else echo missing; fi'
        ).stdout.strip()
        assert repo_check == "found"

        branch_check = sandbox.commands.run(
            f'git -C "{REPO_PATH}" symbolic-ref --short HEAD'
        ).stdout.strip()
        assert branch_check == INITIAL_BRANCH
    finally:
        sandbox.commands.run(f'rm -rf "{REPO_PATH}"')

