from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urlparse, urlunparse

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.commands.command_handle import CommandExitException


@dataclass
class GitFileStatus:
    """
    Parsed git status entry for a file.

    :param name: Path relative to the repository root
    :param status: Normalized status string (e.g. "modified", "added")
    :param index_status: Index status character from porcelain output
    :param working_tree_status: Working tree status character from porcelain output
    :param staged: Whether the change is staged
    :param renamed_from: Original path when the file was renamed
    """

    name: str
    status: str
    index_status: str
    working_tree_status: str
    staged: bool
    renamed_from: Optional[str] = None


@dataclass
class GitStatus:
    """
    Parsed git repository status.

    :param current_branch: Current branch name, if available
    :param upstream: Upstream branch name, if available
    :param ahead: Number of commits the branch is ahead of upstream
    :param behind: Number of commits the branch is behind upstream
    :param detached: Whether HEAD is detached
    :param file_status: List of file status entries
    """

    current_branch: Optional[str]
    upstream: Optional[str]
    ahead: int
    behind: int
    detached: bool
    file_status: List[GitFileStatus]

    @property
    def is_clean(self) -> bool:
        """
        Return True when there are no tracked or untracked file changes.
        """
        return len(self.file_status) == 0

    @property
    def has_changes(self) -> bool:
        """
        Return True when there are any tracked or untracked file changes.
        """
        return len(self.file_status) > 0

    @property
    def has_staged(self) -> bool:
        """
        Return True when at least one file has staged changes.
        """
        return any(item.staged for item in self.file_status)

    @property
    def has_untracked(self) -> bool:
        """
        Return True when at least one file is untracked.
        """
        return any(item.status == "untracked" for item in self.file_status)

    @property
    def has_conflicts(self) -> bool:
        """
        Return True when at least one file is in conflict.
        """
        return any(item.status == "conflict" for item in self.file_status)

    @property
    def total_count(self) -> int:
        """
        Return the total number of changed files.
        """
        return len(self.file_status)

    @property
    def staged_count(self) -> int:
        """
        Return the number of files with staged changes.
        """
        return sum(1 for item in self.file_status if item.staged)

    @property
    def unstaged_count(self) -> int:
        """
        Return the number of files with unstaged changes.
        """
        return sum(1 for item in self.file_status if not item.staged)

    @property
    def untracked_count(self) -> int:
        """
        Return the number of untracked files.
        """
        return sum(1 for item in self.file_status if item.status == "untracked")

    @property
    def conflict_count(self) -> int:
        """
        Return the number of files with merge conflicts.
        """
        return sum(1 for item in self.file_status if item.status == "conflict")


@dataclass
class GitBranches:
    """
    Parsed git branch list.

    :param branches: List of branch names
    :param current_branch: Current branch name, if available
    """

    branches: List[str]
    current_branch: Optional[str]


def shell_escape(value: str) -> str:
    """
    Escape a string for safe use in a shell command.

    :param value: Value to escape
    :return: Shell-escaped string
    """
    return "'" + value.replace("'", "'\"'\"'") + "'"


def with_credentials(url: str, username: Optional[str], password: Optional[str]) -> str:
    """
    Add HTTP(S) credentials to a Git URL.

    :param url: Git repository URL
    :param username: Username for HTTP(S) authentication
    :param password: Password or token for HTTP(S) authentication
    :return: URL with embedded credentials
    """
    if not username and not password:
        return url
    if not username or not password:
        raise InvalidArgumentException(
            "Both username and password are required when using Git credentials."
        )

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise InvalidArgumentException(
            "Only http(s) Git URLs support username/password credentials."
        )

    netloc = f"{username}:{password}@{parsed.netloc}"
    return urlunparse(parsed._replace(netloc=netloc))


def strip_credentials(url: str) -> str:
    """
    Strip HTTP(S) credentials from a Git URL.

    :param url: Git repository URL
    :return: URL without embedded credentials
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url
    if not parsed.username and not parsed.password:
        return url

    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"

    return urlunparse(parsed._replace(netloc=host))


def derive_repo_dir_from_url(url: str) -> Optional[str]:
    """
    Derive the default repository directory name from a Git URL.

    :param url: Git repository URL
    :return: Repository directory name, if it can be determined
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    trimmed_path = parsed.path.rstrip("/")
    if not trimmed_path:
        return None
    last_segment = trimmed_path.split("/")[-1]
    if not last_segment:
        return None
    return last_segment[:-4] if last_segment.endswith(".git") else last_segment


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


def is_auth_failure(err: Exception) -> bool:
    """
    Check whether a git command failed due to authentication issues.

    :param err: Exception raised by a git command
    :return: True when the error matches common authentication failures
    """
    if not isinstance(err, CommandExitException):
        return False

    message = f"{err.stderr}\n{err.stdout}".lower()
    auth_snippets = [
        "authentication failed",
        "terminal prompts disabled",
        "could not read username",
        "invalid username or password",
        "access denied",
        "permission denied",
        "not authorized",
    ]
    return any(snippet in message for snippet in auth_snippets)


def is_missing_upstream(err: Exception) -> bool:
    """
    Check whether a git command failed due to missing upstream tracking.

    :param err: Exception raised by a git command
    :return: True when the error matches common upstream failures
    """
    if not isinstance(err, CommandExitException):
        return False

    message = f"{err.stderr}\n{err.stdout}".lower()
    upstream_snippets = [
        "has no upstream branch",
        "no upstream branch",
        "no upstream configured",
        "no tracking information for the current branch",
        "no tracking information",
        "set the remote as upstream",
        "set the upstream branch",
        "please specify which branch you want to merge with",
    ]
    return any(snippet in message for snippet in upstream_snippets)


def build_auth_error_message(action: str, missing_password: bool) -> str:
    """
    Build a git authentication error message for the given action.

    :param action: Git action name
    :param missing_password: Whether the password/token is missing
    :return: Error message string
    """
    if missing_password:
        return f"Git {action} requires a password/token for private repositories."
    return f"Git {action} requires credentials for private repositories."


def build_upstream_error_message(action: str) -> str:
    """
    Build a git upstream tracking error message for the given action.

    :param action: Git action name
    :return: Error message string
    """
    if action == "push":
        return (
            "Git push failed because no upstream branch is configured. "
            "Set upstream once with set_upstream=True (and optional remote/branch), "
            "or pass remote and branch explicitly."
        )

    return (
        "Git pull failed because no upstream branch is configured. "
        "Pass remote and branch explicitly, or set upstream once (push with "
        "set_upstream=True or run: git branch --set-upstream-to=origin/<branch> <branch>)."
    )


def resolve_config_scope(
    scope: Optional[str], path: Optional[str]
) -> tuple[str, Optional[str]]:
    """
    Resolve a git config scope flag and repository path.

    :param scope: Requested scope ("global", "local", "system")
    :param path: Repository path for local scope
    :return: Tuple of (scope flag, repository path)
    """
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


def _parse_ahead_behind(segment: Optional[str]) -> tuple[int, int]:
    """
    Parse the ahead/behind segment from porcelain branch info.

    :param segment: Segment text like "ahead 2, behind 1"
    :return: Tuple of (ahead, behind)
    """
    if not segment:
        return 0, 0
    ahead = 0
    behind = 0
    if "ahead" in segment:
        try:
            ahead = int(segment.split("ahead")[1].split(",")[0].strip())
        except Exception:
            ahead = 0
    if "behind" in segment:
        try:
            behind = int(segment.split("behind")[1].split(",")[0].strip())
        except Exception:
            behind = 0
    return ahead, behind


def _normalize_branch_name(name: str) -> str:
    """
    Normalize branch names from porcelain branch output.

    :param name: Raw branch name section
    :return: Normalized branch name
    """
    if name.startswith("HEAD (detached at "):
        return name.replace("HEAD (detached at ", "").rstrip(")")
    return (
        name.replace("HEAD (no branch)", "HEAD")
        .replace("No commits yet on ", "")
        .replace("Initial commit on ", "")
    )


def _derive_status(index_status: str, working_status: str) -> str:
    """
    Derive a normalized status label from porcelain status characters.

    :param index_status: Index status character
    :param working_status: Working tree status character
    :return: Normalized status label
    """
    statuses = {index_status, working_status}
    if "U" in statuses:
        return "conflict"
    if "R" in statuses:
        return "renamed"
    if "C" in statuses:
        return "copied"
    if "D" in statuses:
        return "deleted"
    if "A" in statuses:
        return "added"
    if "M" in statuses:
        return "modified"
    if "T" in statuses:
        return "typechange"
    if "?" in statuses:
        return "untracked"
    return "unknown"


def parse_git_status(output: str) -> GitStatus:
    """
    Parse `git status --porcelain=1 -b` output into a structured object.

    :param output: Git status output
    :return: Parsed `GitStatus`
    """
    lines = [line.rstrip() for line in output.split("\n") if line.strip()]
    current_branch: Optional[str] = None
    upstream: Optional[str] = None
    ahead = 0
    behind = 0
    detached = False
    file_status: List[GitFileStatus] = []

    if not lines:
        return GitStatus(
            current_branch=current_branch,
            upstream=upstream,
            ahead=ahead,
            behind=behind,
            detached=detached,
            file_status=file_status,
        )

    branch_line = lines[0]
    if branch_line.startswith("## "):
        branch_info = branch_line[3:]
        ahead_start = branch_info.find(" [")
        branch_part = branch_info if ahead_start == -1 else branch_info[:ahead_start]
        ahead_part = None if ahead_start == -1 else branch_info[ahead_start + 2 : -1]
        normalized_branch = _normalize_branch_name(branch_part)
        raw_branch = branch_part
        is_detached = raw_branch.startswith("HEAD (detached at ") or (
            "detached" in raw_branch
        )

        if is_detached or normalized_branch.startswith("HEAD"):
            detached = True
        elif "..." in normalized_branch:
            branch, upstream_branch = normalized_branch.split("...")
            current_branch = branch or None
            upstream = upstream_branch or None
        else:
            current_branch = normalized_branch or None

        ahead, behind = _parse_ahead_behind(ahead_part)

    for line in lines[1:]:
        if line.startswith("?? "):
            name = line[3:]
            file_status.append(
                GitFileStatus(
                    name=name,
                    status="untracked",
                    index_status="?",
                    working_tree_status="?",
                    staged=False,
                )
            )
            continue

        if len(line) < 3:
            continue
        index_status = line[0]
        working_status = line[1]
        path = line[3:]
        renamed_from: Optional[str] = None
        name = path
        if " -> " in path:
            renamed_from, name = path.split(" -> ", 1)

        file_status.append(
            GitFileStatus(
                name=name,
                status=_derive_status(index_status, working_status),
                index_status=index_status,
                working_tree_status=working_status,
                staged=index_status not in (" ", "?"),
                renamed_from=renamed_from,
            )
        )

    return GitStatus(
        current_branch=current_branch,
        upstream=upstream,
        ahead=ahead,
        behind=behind,
        detached=detached,
        file_status=file_status,
    )


def parse_git_branches(output: str) -> GitBranches:
    """
    Parse `git branch --format=%(refname:short)\t%(HEAD)` output.

    :param output: Git branch output
    :return: Parsed `GitBranches`
    """
    branches: List[str] = []
    current_branch: Optional[str] = None

    lines = [line.strip() for line in output.split("\n") if line.strip()]
    for line in lines:
        parts = line.split("\t")
        name = parts[0]
        branches.append(name)
        if len(parts) > 1 and parts[1] == "*":
            current_branch = name

    return GitBranches(branches=branches, current_branch=current_branch)
