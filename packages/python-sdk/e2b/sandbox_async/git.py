from typing import Dict, List, Optional

from e2b.exceptions import (
    GitAuthException,
    GitUpstreamException,
    InvalidArgumentException,
)
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.sandbox.git_utils import (
    GitBranches,
    GitStatus,
    build_auth_error_message,
    build_git_command,
    build_push_args,
    build_upstream_error_message,
    is_auth_failure,
    is_missing_upstream,
    parse_git_branches,
    parse_git_status,
    resolve_config_scope,
    shell_escape,
    strip_credentials,
    derive_repo_dir_from_url,
    with_credentials,
)
from e2b.sandbox_async.commands.command import Commands


DEFAULT_GIT_ENV = {"GIT_TERMINAL_PROMPT": "0"}


class Git:
    """
    Async module for running git operations in the sandbox.
    """

    def __init__(self, commands: Commands) -> None:
        """
        Create a Git helper bound to the sandbox command runner.

        :param commands: Command runner used to execute git commands
        """
        self._commands = commands

    async def _run_git(
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
        return await self._commands.run(
            cmd,
            envs=merged_envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )

    async def _run_shell(
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
        return await self._commands.run(
            cmd,
            envs=merged_envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )

    async def _has_upstream(
        self,
        path: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            result = await self._run_git(
                ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
                path,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
            )
            return bool(result.stdout.strip())
        except Exception:
            return False

    async def _resolve_remote_name(
        self,
        path: str,
        remote: Optional[str],
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> str:
        if remote:
            return remote

        result = await self._run_git(
            ["remote"],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        remotes = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if len(remotes) == 1:
            return remotes[0]

        raise InvalidArgumentException(
            "Remote is required when using username/password and the repository has multiple remotes."
        )

    async def _with_remote_credentials(
        self,
        path: str,
        remote: str,
        username: str,
        password: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
        operation=None,
    ):
        original_url = await self._get_remote_url(
            path, remote, envs, user, cwd, timeout, request_timeout
        )
        credential_url = with_credentials(original_url, username, password)
        await self._run_git(
            ["remote", "set-url", remote, credential_url],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

        result = None
        operation_error: Exception | None = None
        try:
            if operation is None:
                raise InvalidArgumentException("Operation is required.")
            result = await operation()
        except Exception as err:
            operation_error = err

        restore_error: Exception | None = None
        try:
            await self._run_git(
                ["remote", "set-url", remote, original_url],
                path,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
            )
        except Exception as err:
            restore_error = err

        if operation_error:
            raise operation_error
        if restore_error:
            raise restore_error

        return result

    async def _get_remote_url(
        self,
        path: str,
        remote: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> str:
        result = await self._run_git(
            ["remote", "get-url", remote],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        url = result.stdout.strip()
        if not url:
            raise InvalidArgumentException(
                f'Remote "{remote}" URL not found in repository.'
            )
        return url

    async def clone(
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
        dangerously_store_credentials: bool = False,
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
        :param dangerously_store_credentials: Store credentials in the cloned repository when True
        :return: Command result from the command runner
        """
        if password and not username:
            raise InvalidArgumentException(
                "Username is required when using a password or token for git clone."
            )

        async def attempt_clone(
            auth_username: Optional[str], auth_password: Optional[str]
        ):
            clone_url = (
                with_credentials(url, auth_username, auth_password)
                if auth_username and auth_password
                else url
            )
            sanitized_url = strip_credentials(clone_url)
            should_strip = (
                not dangerously_store_credentials and sanitized_url != clone_url
            )
            repo_path = (
                path if not should_strip else path or derive_repo_dir_from_url(url)
            )
            if should_strip and not repo_path:
                raise InvalidArgumentException(
                    "A destination path is required when using credentials without storing them."
                )
            args = ["clone", clone_url]
            if branch:
                args.extend(["--branch", branch, "--single-branch"])
            if depth:
                args.extend(["--depth", str(depth)])
            if path:
                args.append(path)
            result = await self._run_git(
                args, None, envs, user, cwd, timeout, request_timeout
            )
            if should_strip and repo_path:
                await self._run_git(
                    ["remote", "set-url", "origin", sanitized_url],
                    repo_path,
                    envs,
                    user,
                    cwd,
                    timeout,
                    request_timeout,
                )
            return result

        try:
            return await attempt_clone(username, password)
        except CommandExitException as err:
            if is_auth_failure(err):
                raise GitAuthException(
                    build_auth_error_message("clone", bool(username) and not password)
                ) from err
            raise

    async def init(
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
        return await self._run_git(
            args, None, envs, user, cwd, timeout, request_timeout
        )

    async def remote_add(
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
            return await self._run_git(
                args, path, envs, user, cwd, timeout, request_timeout
            )

        add_cmd = build_git_command(args, path)
        set_url_cmd = build_git_command(["remote", "set-url", name, url], path)
        cmd = f"{add_cmd} || {set_url_cmd}"
        if fetch:
            fetch_cmd = build_git_command(["fetch", name], path)
            cmd = f"({cmd}) && {fetch_cmd}"
        return await self._run_shell(
            cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    async def remote_get(
        self,
        path: str,
        name: str,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> Optional[str]:
        """
        Get the URL for a git remote.

        Returns `None` when the remote does not exist.

        :param path: Repository path
        :param name: Remote name (for example, "origin")
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Remote URL if present, otherwise `None`
        """
        if not name:
            raise InvalidArgumentException("Remote name is required.")

        cmd = f"{build_git_command(['remote', 'get-url', name], path)} || true"
        result = (
            await self._run_shell(
                cmd,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
            )
        ).stdout.strip()
        return result or None

    async def status(
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
        result = await self._run_git(
            ["status", "--porcelain=1", "-b"],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        return parse_git_status(result.stdout)

    async def branches(
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
        result = await self._run_git(
            ["branch", "--format=%(refname:short)\t%(HEAD)"],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )
        return parse_git_branches(result.stdout)

    async def create_branch(
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
        return await self._run_git(
            ["checkout", "-b", branch],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    async def checkout_branch(
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
        return await self._run_git(
            ["checkout", branch],
            path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    async def delete_branch(
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
        return await self._run_git(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def add(
        self,
        path: str,
        files: Optional[List[str]] = None,
        all: bool = True,
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
        return await self._run_git(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def commit(
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
        author_args: List[str] = []
        if author_name:
            author_args.extend(["-c", f"user.name={author_name}"])
        if author_email:
            author_args.extend(["-c", f"user.email={author_email}"])
        if author_args:
            args = author_args + args
        return await self._run_git(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def push(
        self,
        path: str,
        remote: Optional[str] = None,
        branch: Optional[str] = None,
        set_upstream: bool = True,
        username: Optional[str] = None,
        password: Optional[str] = None,
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
        :param username: Username for HTTP(S) authentication
        :param password: Password or token for HTTP(S) authentication
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if password and not username:
            raise InvalidArgumentException(
                "Username is required when using a password or token for git push."
            )

        if username and password:
            remote_name = await self._resolve_remote_name(
                path, remote, envs, user, cwd, timeout, request_timeout
            )
            return await self._with_remote_credentials(
                path,
                remote_name,
                username,
                password,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
                operation=lambda: self._run_git(
                    build_push_args(
                        remote_name,
                        remote=remote,
                        branch=branch,
                        set_upstream=set_upstream,
                    ),
                    path,
                    envs,
                    user,
                    cwd,
                    timeout,
                    request_timeout,
                ),
            )

        try:
            return await self._run_git(
                build_push_args(
                    None,
                    remote=remote,
                    branch=branch,
                    set_upstream=set_upstream,
                ),
                path,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
            )
        except CommandExitException as err:
            if is_auth_failure(err):
                raise GitAuthException(
                    build_auth_error_message("push", bool(username) and not password)
                ) from err
            if is_missing_upstream(err):
                raise GitUpstreamException(
                    build_upstream_error_message("push")
                ) from err
            raise

    async def pull(
        self,
        path: str,
        remote: Optional[str] = None,
        branch: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
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
        :param username: Username for HTTP(S) authentication
        :param password: Password or token for HTTP(S) authentication
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if password and not username:
            raise InvalidArgumentException(
                "Username is required when using a password or token for git pull."
            )

        if not remote and not branch:
            has_upstream = await self._has_upstream(
                path, envs, user, cwd, timeout, request_timeout
            )
            if not has_upstream:
                raise GitUpstreamException(build_upstream_error_message("pull"))

        def build_args(remote_name: Optional[str] = None) -> List[str]:
            args = ["pull"]
            target_remote = remote_name or remote
            if target_remote:
                args.append(target_remote)
            if branch:
                args.append(branch)
            return args

        if username and password:
            remote_name = await self._resolve_remote_name(
                path, remote, envs, user, cwd, timeout, request_timeout
            )
            return await self._with_remote_credentials(
                path,
                remote_name,
                username,
                password,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
                operation=lambda: self._run_git(
                    build_args(remote_name),
                    path,
                    envs,
                    user,
                    cwd,
                    timeout,
                    request_timeout,
                ),
            )

        try:
            return await self._run_git(
                build_args(), path, envs, user, cwd, timeout, request_timeout
            )
        except CommandExitException as err:
            if is_auth_failure(err):
                raise GitAuthException(
                    build_auth_error_message("pull", bool(username) and not password)
                ) from err
            if is_missing_upstream(err):
                raise GitUpstreamException(
                    build_upstream_error_message("pull")
                ) from err
            raise

    async def set_config(
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

        scope_flag, repo_path = resolve_config_scope(scope, path)
        return await self._run_git(
            ["config", scope_flag, key, value],
            repo_path,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    async def get_config(
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

        scope_flag, repo_path = resolve_config_scope(scope, path)
        cmd = (
            f"{build_git_command(['config', scope_flag, '--get', key], repo_path)} "
            "|| true"
        )
        result = (
            await self._run_shell(
                cmd,
                envs,
                user,
                cwd,
                timeout,
                request_timeout,
            )
        ).stdout.strip()
        return result or None

    async def dangerously_authenticate(
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

        This persists credentials in the credential store and may be accessable to agents running on the sandbox.
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

        await self.set_config(
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
        return await self._run_shell(
            approve_cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

    async def configure_user(
        self,
        name: str,
        email: str,
        scope: str = "global",
        path: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Configure git user name and email.

        :param name: Git user name
        :param email: Git user email
        :param scope: Config scope: `global`, `local`, or `system`
        :param path: Repository path required when `scope` is `local`
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :return: Command result from the command runner
        """
        if not name or not email:
            raise InvalidArgumentException("Both name and email are required.")

        await self.set_config(
            "user.name",
            name,
            scope=scope,
            path=path,
            envs=envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )
        return await self.set_config(
            "user.email",
            email,
            scope=scope,
            path=path,
            envs=envs,
            user=user,
            cwd=cwd,
            timeout=timeout,
            request_timeout=request_timeout,
        )
