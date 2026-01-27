import json
import os
import re
import uuid
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

import pytest


if os.getenv("E2B_DEBUG_GITHUB_CREATE_REPO") is None:
    pytest.skip(
        "Set E2B_DEBUG_GITHUB_CREATE_REPO=1 to run debug-only GitHub create repo tests.",
        allow_module_level=True,
    )


TOKEN = os.getenv("E2B_DEBUG_GITHUB_TOKEN")
if not TOKEN:
    pytest.skip(
        "Set E2B_DEBUG_GITHUB_TOKEN to run debug-only GitHub create repo tests.",
        allow_module_level=True,
    )


ORG = os.getenv("E2B_DEBUG_GITHUB_ORG")
REPO_PREFIX = os.getenv("E2B_DEBUG_GITHUB_REPO_PREFIX", "e2b-debug-git-")
API_BASE_URL = os.getenv("E2B_DEBUG_GITHUB_API_BASE_URL", "https://api.github.com")

REPO_PATH = "/tmp/e2b-github-create-repo"


def _sanitize_repo_name(name: str) -> str:
    lowered = name.lower()
    return re.sub(r"[^a-z0-9-]", "-", lowered)[:80]


def _build_repo_name() -> str:
    unique = uuid.uuid4().hex[:10]
    return _sanitize_repo_name(f"{REPO_PREFIX}{unique}")


def _github_delete_repo(token: str, owner: str, name: str, api_base_url: str) -> None:
    base_url = api_base_url.rstrip("/")
    owner_q = urllib_parse.quote(owner)
    name_q = urllib_parse.quote(name)
    url = f"{base_url}/repos/{owner_q}/{name_q}"

    req = urllib_request.Request(
        url,
        method="DELETE",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )

    try:
        with urllib_request.urlopen(req):
            return
    except urllib_error.HTTPError as err:
        body = err.read().decode("utf-8") if err.fp else ""
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {}
        message = parsed.get("message") or body or err.reason
        raise AssertionError(
            f"Failed to delete GitHub repo {owner}/{name}: {err.code} {message}"
        ) from err


def test_create_github_repo_creates_remote_and_wires_origin(sandbox_factory):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    repo_name = _build_repo_name()
    owner_login: str | None = None

    sandbox.commands.run(f'rm -rf "{REPO_PATH}"')

    try:
        sandbox.git.init(REPO_PATH, initial_branch="main")

        repo = sandbox.git.create_github_repo(
            TOKEN,
            repo_name,
            org=ORG,
            private=True,
            auto_init=False,
            api_base_url=API_BASE_URL,
            add_remote_path=REPO_PATH,
            add_remote_overwrite=True,
        )
        owner_login = repo.get("owner_login") or None

        remote_url = sandbox.commands.run(
            f'git -C "{REPO_PATH}" remote get-url origin'
        ).stdout
        assert repo_name in remote_url
    finally:
        sandbox.commands.run(f'rm -rf "{REPO_PATH}"')
        if owner_login:
            _github_delete_repo(TOKEN, owner_login, repo_name, API_BASE_URL)
