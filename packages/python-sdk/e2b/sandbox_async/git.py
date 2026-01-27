from typing import Dict, List, Optional

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.git_utils import (
    GitBranches,
    GitStatus,
    build_git_command,
    parse_git_branches,
    parse_git_status,
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

    async def _run(
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
        return await self._run(
            args, None, envs, user, cwd, timeout, request_timeout
        )

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
        result = await self._run(
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
        result = await self._run(
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
        return await self._run(
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
        return await self._run(
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
        return await self._run(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def add(
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
        return await self._run(
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
        return await self._run(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def push(
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
        return await self._run(
            args, path, envs, user, cwd, timeout, request_timeout
        )

    async def pull(
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
        return await self._run(
            args, path, envs, user, cwd, timeout, request_timeout
        )
