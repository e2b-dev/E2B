import json
import os
from typing import Any, Dict, List, Optional, TypedDict
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from e2b.sandbox.git_utils import (
    GitBranches,
    GitStatus,
    build_git_command,
    parse_git_branches,
    parse_git_status,
    shell_escape,
    with_credentials,
)
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox_sync.commands.command import Commands


DEFAULT_GIT_ENV = {"GIT_TERMINAL_PROMPT": "0"}


class GitHubRepoInfo(TypedDict, total=False):
    """
    Minimal GitHub repository information returned by :meth:`create_github_repo`.
    """

    name: str
    full_name: str
    clone_url: str
    ssh_url: str
    html_url: str
    owner_login: str
    default_branch: str
    private: bool


class Git:
    """
    Module for running git operations in the sandbox.
    """

    def __init__(self, commands: Commands) -> None:
        """
        Create a Git helper bound to the sandbox command runner.

        :param commands: Command runner used to execute git commands
        """
        self._commands = commands

    def _run(
        self,
        args: List[str],
        repo_path: Optional[str],
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Build and execute a git command inside the sandbox.

        :param args: Git arguments to pass to the git binary
        :param repo_path: Repository path used with `git -C`, if provided
        :param envs: Extra environment variables for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        cmd = build_git_command(args, repo_path)
        merged_envs = {**DEFAULT_GIT_ENV, **(envs or {})}
        return self._commands.run(
            cmd,
            envs=merged_envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )

    def _run_shell(
        self,
        cmd: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Execute a raw shell command while applying default git environment variables.

        :param cmd: Shell command to execute
        :param envs: Extra environment variables for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        merged_envs = {**DEFAULT_GIT_ENV, **(envs or {})}
        return self._commands.run(
            cmd,
            envs=merged_envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )

    def clone(
        self,
        url: str,
        path: Optional[str] = None,
        branch: Optional[str] = None,
        depth: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Clone a git repository into the sandbox.

        :param url: Git repository URL
        :param path: Destination path for the clone
        :param branch: Branch to check out
        :param depth: If set, perform a shallow clone with this depth
        :param username: Username for HTTP(S) authentication
        :param password: Password or token for HTTP(S) authentication
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        clone_url = with_credentials(url, username, password)
        args = ["clone", clone_url]
        if branch:
            args.extend(["--branch", branch, "--single-branch"])
        if depth:
            args.extend(["--depth", str(depth)])
        if path:
            args.append(path)
        return self._run(args, None, envs, user, cwd, timeout, request_timeout)

    def init(
        self,
        path: str,
        bare: bool = False,
        initial_branch: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Initialize a new git repository.

        :param path: Destination path for the repository
        :param bare: Create a bare repository when True
        :param initial_branch: Initial branch name (for example, "main")
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["init"]
        if initial_branch:
            args.extend(["--initial-branch", initial_branch])
        if bare:
            args.append("--bare")
        args.append(path)
        return self._run(args, None, envs, user, cwd, timeout, request_timeout)

    def _resolve_github_token(self, token: Optional[str]) -> str:
        resolved = (
            token
            or os.getenv("GITHUB_PAT")
            or os.getenv("GITHUB_TOKEN")
            or os.getenv("GH_TOKEN")
        )
        if not resolved:
            raise InvalidArgumentException(
                "GitHub token is required. Pass token or set GITHUB_PAT/GITHUB_TOKEN/GH_TOKEN."
            )
        return resolved

    def _github_request(
        self,
        method: str,
        url: str,
        token: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a GitHub API request and return the parsed JSON response.
        """
        data = (
            json.dumps(payload).encode("utf-8")
            if payload is not None
            else None
        )
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        req = urllib_request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib_request.urlopen(req) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {}
        except urllib_error.HTTPError as err:
            body = err.read().decode("utf-8") if err.fp else ""
            try:
                parsed = json.loads(body) if body else {}
            except Exception:
                parsed = {}
            message = parsed.get("message") or body or err.reason
            raise InvalidArgumentException(
                f"GitHub API request failed ({err.code}): {message}"
            ) from err

    def create_github_repo(
        self,
        name: str,
        *,
        token: Optional[str] = None,
        org: Optional[str] = None,
        description: Optional[str] = None,
        private: Optional[bool] = None,
        auto_init: Optional[bool] = None,
        homepage: Optional[str] = None,
        gitignore_template: Optional[str] = None,
        license_template: Optional[str] = None,
        api_base_url: str = "https://api.github.com",
        add_remote_path: Optional[str] = None,
        add_remote_name: str = "origin",
        add_remote_use_ssh: bool = False,
        add_remote_fetch: bool = False,
        add_remote_overwrite: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> GitHubRepoInfo:
        """
        Create a new GitHub repository (remote).

        When ``add_remote_path`` is provided, the created repository is added as
        a remote in an existing sandbox repository.
        It does not initialize a local repository.

        ``token`` is optional if one of ``GITHUB_PAT``, ``GITHUB_TOKEN``,
        or ``GH_TOKEN`` is set in the local environment.
        """
        if not name:
            raise InvalidArgumentException(
                "Repository name is required to create a GitHub repository."
            )

        resolved_token = self._resolve_github_token(token)

        base_url = api_base_url.rstrip("/")
        if org:
            endpoint = f"/orgs/{urllib_parse.quote(org)}/repos"
        else:
            endpoint = "/user/repos"

        payload: Dict[str, Any] = {"name": name}
        if description is not None:
            payload["description"] = description
        if private is not None:
            payload["private"] = private
        if auto_init is not None:
            payload["auto_init"] = auto_init
        if homepage is not None:
            payload["homepage"] = homepage
        if gitignore_template is not None:
            payload["gitignore_template"] = gitignore_template
        if license_template is not None:
            payload["license_template"] = license_template

        data = self._github_request(
            "POST", f"{base_url}{endpoint}", resolved_token, payload
        )

        repo: GitHubRepoInfo = {
            "name": data.get("name", ""),
            "full_name": data.get("full_name", ""),
            "clone_url": data.get("clone_url", ""),
            "ssh_url": data.get("ssh_url", ""),
            "html_url": data.get("html_url", ""),
            "owner_login": (data.get("owner") or {}).get("login", ""),
            "default_branch": data.get("default_branch", ""),
            "private": bool(data.get("private", False)),
        }

        if add_remote_path:
            remote_url = repo["ssh_url"] if add_remote_use_ssh else repo["clone_url"]
            self.remote_add(
                add_remote_path,
                add_remote_name,
                remote_url,
                fetch=add_remote_fetch,
                overwrite=add_remote_overwrite,
                envs=envs,
                user=user,
                cwd=cwd,
                timeout=timeout,
                request_timeout=request_timeout,
            )

        return repo

    def remote_add(
        self,
        path: str,
        name: str,
        url: str,
        fetch: bool = False,
        overwrite: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Add (or update) a remote for a repository.

        :param path: Repository path
        :param name: Remote name (for example, "origin")
        :param url: Remote URL
        :param fetch: Fetch the remote after adding it when True
        :param overwrite: Overwrite the remote URL if it already exists when True
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if not name or not url:
            raise InvalidArgumentException(
                "Both remote name and URL are required to add a git remote."
            )

        args = ["remote", "add"]
        if fetch:
            args.append("-f")
        args.extend([name, url])

        if not overwrite:
            return self._run(args, path, envs, user, cwd, timeout, request_timeout)

        add_cmd = build_git_command(args, path)
        set_url_cmd = build_git_command(["remote", "set-url", name, url], path)
        return self._run_shell(
            f"{add_cmd} || {set_url_cmd}",
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    def status(
        self,
        path: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> GitStatus:
        """
        Get repository status information.

        :param path: Repository path
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Parsed git status
        """
        result = self._run(
            ["status", "--porcelain=1", "-b"],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        return parse_git_status(result.stdout)

    def branches(
        self,
        path: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> GitBranches:
        """
        List branches in a repository.

        :param path: Repository path
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Parsed branch list
        """
        result = self._run(
            ["branch", "--format=%(refname:short)\t%(HEAD)"],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        return parse_git_branches(result.stdout)

    def create_branch(
        self,
        path: str,
        branch: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Create and check out a new branch.

        :param path: Repository path
        :param branch: Branch name to create
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        return self._run(
            ["checkout", "-b", branch],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    def checkout_branch(
        self,
        path: str,
        branch: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Check out an existing branch.

        :param path: Repository path
        :param branch: Branch name to check out
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        return self._run(
            ["checkout", branch],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    def delete_branch(
        self,
        path: str,
        branch: str,
        force: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Delete a branch.

        :param path: Repository path
        :param branch: Branch name to delete
        :param force: Force deletion with `-D` when `True`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["branch", "-D" if force else "-d", branch]
        return self._run(args, path, envs, user, cwd, timeout, request_timeout)

    def add(
        self,
        path: str,
        files: Optional[List[str]] = None,
        all: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Stage files for commit.

        :param path: Repository path
        :param files: Files to add; when omitted, adds the current directory
        :param all: When `True` and `files` is omitted, stage all changes
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["add"]
        if not files:
            args.append("-A" if all else ".")
        else:
            args.append("--")
            args.extend(files)
        return self._run(args, path, envs, user, cwd, timeout, request_timeout)

    def commit(
        self,
        path: str,
        message: str,
        author_name: Optional[str] = None,
        author_email: Optional[str] = None,
        allow_empty: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Create a commit in the repository.

        :param path: Repository path
        :param message: Commit message
        :param author_name: Commit author name
        :param author_email: Commit author email
        :param allow_empty: Allow empty commits when `True`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["commit", "-m", message]
        if allow_empty:
            args.append("--allow-empty")
        if (author_name and not author_email) or (author_email and not author_name):
            raise InvalidArgumentException(
                "Both author_name and author_email are required to set commit author."
            )
        if author_name and author_email:
            args = [
                "-c",
                f"user.name={author_name}",
                "-c",
                f"user.email={author_email}",
            ] + args
        return self._run(args, path, envs, user, cwd, timeout, request_timeout)

    def push(
        self,
        path: str,
        remote: Optional[str] = None,
        branch: Optional[str] = None,
        set_upstream: bool = False,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Push commits to a remote.

        :param path: Repository path
        :param remote: Remote name, e.g. `origin`
        :param branch: Branch name to push
        :param set_upstream: Set upstream tracking when `True`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["push"]
        if set_upstream:
            args.append("--set-upstream")
        if remote:
            args.append(remote)
        if branch:
            args.append(branch)
        return self._run(args, path, envs, user, cwd, timeout, request_timeout)

    def pull(
        self,
        path: str,
        remote: Optional[str] = None,
        branch: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Pull changes from a remote.

        :param path: Repository path
        :param remote: Remote name, e.g. `origin`
        :param branch: Branch name to pull
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        args = ["pull"]
        if remote:
            args.append(remote)
        if branch:
            args.append(branch)
        return self._run(args, path, envs, user, cwd, timeout, request_timeout)

    def config_set(
        self,
        key: str,
        value: str,
        scope: str = "global",
        path: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Set a git config value.

        Use `scope="local"` together with `path` to configure a specific repository.

        :param key: Git config key (e.g. `pull.rebase`)
        :param value: Git config value
        :param scope: Config scope: `global`, `local`, or `system`
        :param path: Repository path required when `scope` is `local`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if not key:
            raise InvalidArgumentException("Git config key is required.")

        scope_flag, repo_path = self._resolve_config_scope(scope, path)
        return self._run(
            ["config", scope_flag, key, value],
            repo_path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    def config_get(
        self,
        key: str,
        scope: str = "global",
        path: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> Optional[str]:
        """
        Get a git config value.

        Returns `None` when the key is not set in the requested scope.

        :param key: Git config key (e.g. `pull.rebase`)
        :param scope: Config scope: `global`, `local`, or `system`
        :param path: Repository path required when `scope` is `local`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Config value if present, otherwise `None`
        """
        if not key:
            raise InvalidArgumentException("Git config key is required.")

        scope_flag, repo_path = self._resolve_config_scope(scope, path)
        cmd = (
            f"{build_git_command(['config', scope_flag, '--get', key], repo_path)} "
            "|| true"
        )
        result = self._run_shell(
            cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        ).stdout.strip()
        return result or None

    def dangerously_authenticate(
        self,
        username: str,
        password: str,
        host: str = "github.com",
        protocol: str = "https",
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Dangerously authenticate git globally via the credential helper.

        This persists credentials in the credential store and may leak secrets to logs.
        Prefer short-lived credentials when possible.

        :param username: Username for HTTP(S) authentication
        :param password: Password or token for HTTP(S) authentication
        :param host: Host to authenticate for, defaults to `github.com`
        :param protocol: Protocol to authenticate for, defaults to `https`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if not username or not password:
            raise InvalidArgumentException(
                "Both username and password are required to authenticate git."
            )

        target_host = host.strip() or "github.com"
        target_protocol = protocol.strip() or "https"
        credential_input = "\n".join(
            [
                f"protocol={target_protocol}",
                f"host={target_host}",
                f"username={username}",
                f"password={password}",
                "",
                "",
            ]
        )

        self.config_set(
            "credential.helper",
            "store",
            scope="global",
            envs=envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )
        approve_cmd = (
            f"printf %s {shell_escape(credential_input)} | "
            f"{build_git_command(['credential', 'approve'])}"
        )
        return self._run_shell(
            approve_cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    def configure_user(
        self,
        name: str,
        email: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Configure global git user name and email.

        :param name: Git user name
        :param email: Git user email
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if not name or not email:
            raise InvalidArgumentException("Both name and email are required.")

        self.config_set(
            "user.name",
            name,
            scope="global",
            envs=envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )
        return self.config_set(
            "user.email",
            email,
            scope="global",
            envs=envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )

    def _resolve_config_scope(
        self, scope: str, path: Optional[str]
    ) -> tuple[str, Optional[str]]:
        scope_name = (scope or "global").strip().lower()
        if scope_name not in {"global", "local", "system"}:
            raise InvalidArgumentException(
                "Git config scope must be one of: global, local, system."
            )

        if scope_name == "local":
            if not path:
                raise InvalidArgumentException(
                    "Repository path is required when scope is local."
                )
            return "--local", path

        if scope_name == "system":
            return "--system", None

        return "--global", None
