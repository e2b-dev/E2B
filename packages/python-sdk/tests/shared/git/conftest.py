import random
from uuid import uuid4

import pytest

BASE_DIR = "/tmp/test-git"


@pytest.fixture
def git_sandbox(sandbox_factory):
    return sandbox_factory(timeout=10)


@pytest.fixture
def git_author():
    return "Sandbox Bot", "sandbox@example.com"


@pytest.fixture
def git_credentials():
    return "git", "token", "example.com", "https"


@pytest.fixture
def git_base_dir(git_sandbox):
    base_dir = f"{BASE_DIR}/{uuid4().hex}"
    git_sandbox.commands.run(f'rm -rf "{base_dir}" && mkdir -p "{base_dir}"')
    yield base_dir
    git_sandbox.commands.run(f'rm -rf "{base_dir}"')


@pytest.fixture
def git_repo(git_sandbox, git_base_dir, git_author):
    repo_path = f"{git_base_dir}/repo"
    git_sandbox.git.init(repo_path, initial_branch="main")
    author_name, author_email = git_author
    git_sandbox.git.configure_user(author_name, author_email)
    return repo_path


@pytest.fixture
def git_repo_with_commit(git_sandbox, git_repo, git_author):
    author_name, author_email = git_author
    git_sandbox.files.write(f"{git_repo}/README.md", "hello\n")
    git_sandbox.git.add(git_repo, all=True)
    git_sandbox.git.commit(
        git_repo,
        message="Initial commit",
        author_name=author_name,
        author_email=author_email,
    )
    return git_repo


@pytest.fixture
def git_daemon(git_sandbox, git_base_dir):
    remote_path = f"{git_base_dir}/remote.git"
    git_sandbox.commands.run(f'git init --bare --initial-branch=main "{remote_path}"')
    port = 9418 + random.randint(0, 1000)
    cmd = (
        f'git daemon --reuseaddr --base-path="{git_base_dir}" --export-all '
        f"--enable=receive-pack --informative-errors --listen=127.0.0.1 --port={port}"
    )
    handle = git_sandbox.commands.run(cmd, background=True)
    git_sandbox.commands.run("sleep 1")
    try:
        yield {
            "remote_path": remote_path,
            "remote_url": f"git://127.0.0.1:{port}/remote.git",
            "port": port,
            "base_dir": git_base_dir,
        }
    finally:
        handle.kill()
