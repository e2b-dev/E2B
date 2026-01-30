from typing import List, Optional

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.git.auth import strip_credentials, with_credentials
from e2b.sandbox.git.parse import derive_repo_dir_from_url
from e2b.sandbox.git.types import ClonePlan


def shell_escape(value: str) -> str:
    """
    Escape a string for safe use in a shell command.

    :param value: Value to escape
    :return: Shell-escaped string
    """
    return "'" + value.replace("'", "'\"'\"'") + "'"


def build_git_command(args: List[str], repo_path: Optional[str] = None) -> str:
    """
    Build a shell-safe git command string.

    :param args: Git command arguments
    :param repo_path: Repository path for `git -C`, if provided
    :return: Shell-safe git command
    """
    parts = ["git"]
    if repo_path:
        parts.extend(["-C", repo_path])
    parts.extend(args)
    return " ".join(shell_escape(part) for part in parts)


def build_push_args(
    remote_name: Optional[str],
    *,
    remote: Optional[str],
    branch: Optional[str],
    set_upstream: bool,
) -> List[str]:
    """
    Build arguments for a git push command.

    :param remote_name: Resolved remote name, if any
    :param remote: Remote name override
    :param branch: Branch name to push
    :param set_upstream: Whether to set upstream tracking
    :return: List of git push arguments
    """
    args = ["push"]
    target_remote = remote_name or remote
    if set_upstream and target_remote:
        args.append("--set-upstream")
    if target_remote:
        args.append(target_remote)
    if branch:
        args.append(branch)
    return args


def build_pull_args(
    remote: Optional[str],
    branch: Optional[str],
    remote_name: Optional[str] = None,
) -> List[str]:
    """
    Build arguments for a git pull command.

    :param remote: Remote name override
    :param branch: Branch name to pull
    :param remote_name: Resolved remote name, if any
    :return: List of git pull arguments
    """
    args = ["pull"]
    target_remote = remote_name or remote
    if target_remote:
        args.append(target_remote)
    if branch:
        args.append(branch)
    return args


def build_remote_add_args(name: str, url: str, fetch: bool) -> List[str]:
    """
    Build arguments for a git remote add command.

    :param name: Remote name
    :param url: Remote URL
    :param fetch: Whether to fetch after adding the remote
    :return: List of git remote add arguments
    """
    if not name or not url:
        raise InvalidArgumentException(
            "Both remote name and URL are required to add a git remote."
        )

    args = ["remote", "add"]
    if fetch:
        args.append("-f")
    args.extend([name, url])
    return args


def build_remote_add_shell_command(
    args: List[str],
    path: str,
    name: str,
    url: str,
    fetch: bool,
) -> str:
    """
    Build a shell command that adds or updates a remote and optionally fetches.

    :param args: Base git remote add args
    :param path: Repository path
    :param name: Remote name
    :param url: Remote URL
    :param fetch: Whether to fetch after adding the remote
    :return: Shell command string
    """
    add_cmd = build_git_command(args, path)
    set_url_cmd = build_git_command(["remote", "set-url", name, url], path)
    cmd = f"{add_cmd} || {set_url_cmd}"
    if fetch:
        fetch_cmd = build_git_command(["fetch", name], path)
        cmd = f"({cmd}) && {fetch_cmd}"
    return cmd


def build_remote_get_command(path: str, name: str) -> str:
    """
    Build a shell command that returns the remote URL or empty output.

    :param path: Repository path
    :param name: Remote name
    :return: Shell command string
    """
    if not name:
        raise InvalidArgumentException("Remote name is required.")

    return f"{build_git_command(['remote', 'get-url', name], path)} || true"


def build_status_args() -> List[str]:
    """
    Build arguments for a git status command.
    """
    return ["status", "--porcelain=1", "-b"]


def build_branches_args() -> List[str]:
    """
    Build arguments for a git branch listing command.
    """
    return ["branch", "--format=%(refname:short)\t%(HEAD)"]


def build_create_branch_args(branch: str) -> List[str]:
    """
    Build arguments for a git checkout -b command.
    """
    return ["checkout", "-b", branch]


def build_checkout_branch_args(branch: str) -> List[str]:
    """
    Build arguments for a git checkout command.
    """
    return ["checkout", branch]


def build_delete_branch_args(branch: str, force: bool) -> List[str]:
    """
    Build arguments for a git branch delete command.
    """
    return ["branch", "-D" if force else "-d", branch]


def build_add_args(files: Optional[List[str]], all: bool) -> List[str]:
    """
    Build arguments for a git add command.
    """
    args = ["add"]
    if not files:
        args.append("-A" if all else ".")
    else:
        args.append("--")
        args.extend(files)
    return args


def build_commit_args(
    message: str,
    author_name: Optional[str],
    author_email: Optional[str],
    allow_empty: bool,
) -> List[str]:
    """
    Build arguments for a git commit command.
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
    return args


def build_reset_args(
    mode: Optional[str],
    target: Optional[str],
    paths: Optional[List[str]],
) -> List[str]:
    """
    Build arguments for a git reset command.
    """
    allowed_modes = {"soft", "mixed", "hard", "merge", "keep"}
    if mode and mode not in allowed_modes:
        raise InvalidArgumentException(
            f"Reset mode must be one of {', '.join(sorted(allowed_modes))}."
        )

    args = ["reset"]
    if mode:
        args.append(f"--{mode}")
    if target:
        args.append(target)
    if paths:
        args.append("--")
        args.extend(paths)
    return args


def build_restore_args(
    paths: List[str],
    staged: Optional[bool],
    worktree: Optional[bool],
    source: Optional[str],
) -> List[str]:
    """
    Build arguments for a git restore command.
    """
    if not paths:
        raise InvalidArgumentException("At least one path is required.")

    resolved_staged = staged
    resolved_worktree = worktree
    if staged is None and worktree is None:
        resolved_worktree = True
    elif staged is True and worktree is None:
        resolved_worktree = False
    elif staged is None and worktree is not None:
        resolved_staged = False

    if resolved_staged is False and resolved_worktree is False:
        raise InvalidArgumentException(
            "At least one of staged or worktree must be true."
        )

    args = ["restore"]
    if resolved_worktree:
        args.append("--worktree")
    if resolved_staged:
        args.append("--staged")
    if source:
        args.extend(["--source", source])
    args.append("--")
    args.extend(paths)
    return args


def build_clone_plan(
    url: str,
    path: Optional[str],
    branch: Optional[str],
    depth: Optional[int],
    auth_username: Optional[str],
    auth_password: Optional[str],
    dangerously_store_credentials: bool,
) -> ClonePlan:
    """
    Build clone arguments and metadata for post-clone credential stripping.
    """
    clone_url = (
        with_credentials(url, auth_username, auth_password)
        if auth_username and auth_password
        else url
    )
    sanitized_url = strip_credentials(clone_url)
    should_strip = not dangerously_store_credentials and sanitized_url != clone_url
    repo_path = path if not should_strip else path or derive_repo_dir_from_url(url)
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

    return ClonePlan(
        args=args,
        repo_path=repo_path,
        sanitized_url=sanitized_url if should_strip else None,
        should_strip=should_strip,
    )
