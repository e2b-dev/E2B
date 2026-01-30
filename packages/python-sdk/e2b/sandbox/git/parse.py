from typing import List, Optional
from urllib.parse import urlparse

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.git.types import GitBranches, GitFileStatus, GitStatus


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


def parse_remote_url(output: str, remote: str) -> str:
    """
    Parse a git remote URL output and validate it's present.

    :param output: Git remote get-url output
    :param remote: Remote name for the error message
    :return: Remote URL
    """
    url = output.strip()
    if not url:
        raise InvalidArgumentException(
            f'Remote "{remote}" URL not found in repository.'
        )
    return url
