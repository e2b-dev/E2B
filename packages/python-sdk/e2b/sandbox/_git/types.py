from dataclasses import dataclass
from typing import List, Optional


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


@dataclass
class ClonePlan:
    """
    Prepared arguments and metadata for git clone.

    :param args: Command arguments for git clone
    :param repo_path: Repository path to use for post-clone adjustments
    :param sanitized_url: Credential-stripped URL to restore
    :param should_strip: Whether to reset the remote URL after clone
    """

    args: List[str]
    repo_path: Optional[str]
    sanitized_url: Optional[str]
    should_strip: bool
