from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union, cast

from typing_extensions import NotRequired, Unpack

from e2b import ConnectionConfig
from e2b.api.client.models import ListedSandbox, SandboxDetail, SandboxState
from e2b.connection_config import ApiParams
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.mcp import McpServer as BaseMcpServer


class GitHubMcpServerConfig(TypedDict):
    """
    Configuration for a GitHub-based MCP server.
    """

    run_cmd: str
    """
    Command to run the MCP server. Must start a stdio-compatible server.
    """
    install_cmd: NotRequired[str]
    """
    Command to install dependencies for the MCP server. Working directory is the root of the github repository.
    """
    envs: NotRequired[Dict[str, str]]
    """
    Environment variables to set in the MCP process.
    """


# Extended MCP server configuration that includes base servers
# and allows dynamic GitHub-based MCP servers with custom run and install commands.
# For GitHub servers, use keys in the format "github/owner/repo"
GitHubMcpServer = Dict[str, Union[GitHubMcpServerConfig, Any]]

# Union type that combines base MCP servers with GitHub-based servers
McpServer = Union[BaseMcpServer, GitHubMcpServer]


class SandboxNetworkOpts(TypedDict):
    """
    Sandbox network configuration options.
    """

    allow_out: NotRequired[List[str]]
    """
    Allow outbound traffic from the sandbox to the specified addresses.
    If `allow_out` is not specified, all outbound traffic is allowed.

    Examples:
    - To allow traffic to specific addresses: `["1.1.1.1", "8.8.8.0/24"]`
    """

    deny_out: NotRequired[List[str]]
    """
    Deny outbound traffic from the sandbox to the specified addresses.

    Examples:
    - To deny traffic to specific addresses: `["1.1.1.1", "8.8.8.0/24"]`
    """

    allow_public_traffic: NotRequired[bool]
    """
    Controls whether sandbox URLs should be publicly accessible or require authentication.
    Defaults to True.
    """

    mask_request_host: NotRequired[str]
    """
    Allows specifying a custom host mask for all sandbox requests.
    Supports ${PORT} variable. Defaults to "${PORT}-sandboxid.e2b.app".

    Examples:
    - Custom subdomain: `"${PORT}-myapp.example.com"`
    """


class SandboxLifecycle(TypedDict):
    """
    Sandbox lifecycle configuration; defines post-timeout behavior and auto-resume policies.
    Defaults to `on_timeout="kill"` and `auto_resume=False`.
    """

    on_timeout: Literal["pause", "kill"]
    """
    What should happen to the sandbox when timeout is reached. `"kill"` means the sandbox will be terminated, while `"pause"` means the sandbox will be paused and can be resumed later. Defaults to `"kill"`.
    """

    auto_resume: NotRequired[bool]
    """
    Whether activity should cause the sandbox to resume when paused. Defaults to `False`.
    Maps to API policy: `True -> "any"`, `False -> "off"`.
    Can be `True` only when `on_timeout` is `pause`.
    """


def validate_lifecycle(lifecycle: SandboxLifecycle) -> None:
    on_timeout = lifecycle.get("on_timeout")
    auto_resume = lifecycle.get("auto_resume")

    if on_timeout not in ("kill", "pause"):
        raise InvalidArgumentException(
            f"`lifecycle.on_timeout` must be 'kill' or 'pause', got '{on_timeout}'"
        )
    if auto_resume is not None and not isinstance(auto_resume, bool):
        raise InvalidArgumentException(
            f"`lifecycle.auto_resume` must be a boolean, got '{auto_resume}'"
        )
    if auto_resume is True and on_timeout != "pause":
        raise InvalidArgumentException(
            "`lifecycle.auto_resume` can be true only when `lifecycle.on_timeout` is 'pause'"
        )


def get_auto_resume_policy(lifecycle: Optional[SandboxLifecycle]) -> Optional[str]:
    if lifecycle is None or lifecycle.get("on_timeout") != "pause":
        return None

    auto_resume = lifecycle.get("auto_resume")
    return "any" if auto_resume else "off"


@dataclass
class SandboxInfo:
    """Information about a sandbox."""

    sandbox_id: str
    """Sandbox ID."""
    sandbox_domain: Optional[str]
    """Domain where the sandbox is hosted."""
    template_id: str
    """Template ID."""
    name: Optional[str]
    """Template name."""
    metadata: Dict[str, str]
    """Saved sandbox metadata."""
    started_at: datetime
    """Sandbox start time."""
    end_at: datetime
    """Sandbox expiration date."""
    state: SandboxState
    """Sandbox state."""
    cpu_count: int
    """Sandbox CPU count."""
    memory_mb: int
    """Sandbox Memory size in MiB."""
    envd_version: str
    """Envd version."""
    _envd_access_token: Optional[str]
    """Envd access token."""

    @classmethod
    def _from_sandbox_data(
        cls,
        sandbox: Union[ListedSandbox, SandboxDetail],
        envd_access_token: Optional[str] = None,
        sandbox_domain: Optional[str] = None,
    ):
        return cls(
            sandbox_domain=sandbox_domain,
            sandbox_id=sandbox.sandbox_id,
            template_id=sandbox.template_id,
            name=(sandbox.alias if isinstance(sandbox.alias, str) else None),
            metadata=cast(
                Dict[str, str],
                sandbox.metadata if isinstance(sandbox.metadata, dict) else {},
            ),
            started_at=sandbox.started_at,
            end_at=sandbox.end_at,
            state=sandbox.state,
            cpu_count=sandbox.cpu_count,
            memory_mb=sandbox.memory_mb,
            envd_version=sandbox.envd_version,
            _envd_access_token=envd_access_token,
        )

    @classmethod
    def _from_listed_sandbox(cls, listed_sandbox: ListedSandbox):
        return cls._from_sandbox_data(listed_sandbox)

    @classmethod
    def _from_sandbox_detail(cls, sandbox_detail: SandboxDetail):
        return cls._from_sandbox_data(
            sandbox_detail,
            (
                sandbox_detail.envd_access_token
                if isinstance(sandbox_detail.envd_access_token, str)
                else None
            ),
            sandbox_domain=(
                sandbox_detail.domain
                if isinstance(sandbox_detail.domain, str)
                else None
            ),
        )


@dataclass
class SandboxQuery:
    """Query parameters for listing sandboxes."""

    metadata: Optional[dict[str, str]] = None
    """Filter sandboxes by metadata."""

    state: Optional[list[SandboxState]] = None
    """Filter sandboxes by state."""


@dataclass
class SandboxMetrics:
    """Sandbox metrics."""

    cpu_count: int
    """Number of CPUs."""
    cpu_used_pct: float
    """CPU usage percentage."""
    disk_total: int
    """Total disk space in bytes."""
    disk_used: int
    """Disk used in bytes."""
    mem_total: int
    """Total memory in bytes."""
    mem_used: int
    """Memory used in bytes."""
    timestamp: datetime
    """Timestamp of the metric entry."""


@dataclass
class SnapshotInfo:
    """Information about a snapshot."""

    snapshot_id: str
    """Snapshot identifier — template ID with tag, or namespaced name with tag (e.g. my-snapshot:latest). Can be used with Sandbox.create() to create a new sandbox from this snapshot."""


class PaginatorBase:
    def __init__(
        self,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        self._config = ConnectionConfig(**opts)
        self.limit = limit
        self._has_next = True
        self._next_token = next_token

    @property
    def has_next(self) -> bool:
        """
        Returns True if there are more items to fetch.
        """
        return self._has_next

    @property
    def next_token(self) -> Optional[str]:
        """
        Returns the next token to use for pagination.
        """
        return self._next_token


class SnapshotPaginatorBase(PaginatorBase):
    def __init__(
        self,
        sandbox_id: Optional[str] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        super().__init__(limit=limit, next_token=next_token, **opts)
        self.sandbox_id = sandbox_id


class SandboxPaginatorBase(PaginatorBase):
    def __init__(
        self,
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        super().__init__(limit=limit, next_token=next_token, **opts)
        self.query = query
