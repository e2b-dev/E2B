from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Literal, Optional, TypedDict, Union, cast

from typing_extensions import NotRequired, Unpack

from e2b import ConnectionConfig
from e2b.api.client.models import (
    ListedSandbox,
    SandboxDetail,
    SandboxFirewall as ClientSandboxFirewall,
    SandboxLifecycle as ClientSandboxLifecycle,
    SandboxNetworkConfig,
    SandboxState,
)
from e2b.api.client.types import Unset
from e2b.connection_config import ApiParams
from e2b.sandbox.mcp import McpServer as BaseMcpServer
from e2b.sandbox.network import ALL_TRAFFIC


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


class SandboxFirewallRuleTransform(TypedDict):
    """
    Transform applied to outbound requests matching a `SandboxFirewallRule`.
    """

    headers: NotRequired[Dict[str, str]]
    """
    Headers to inject into the outbound request. Values override any headers
    already present on the request.
    """


class SandboxFirewallRule(TypedDict):
    """
    Firewall rule applied to outbound requests matching the host it is
    registered under in `firewall`.
    """

    transform: NotRequired[SandboxFirewallRuleTransform]
    """Transform applied to requests matching this rule."""


SandboxFirewall = Dict[str, List[SandboxFirewallRule]]
"""
Map of host (or CIDR / IP) to ordered list of firewall rules applied to
outbound requests for that host. Registering a host here does not allow egress
on its own — the host must also appear in ``SandboxNetworkOpts.allow_out``.
"""


@dataclass(frozen=True)
class SandboxNetworkSelectorContext:
    """
    Context passed to ``allow_out``/``deny_out`` callables.
    """

    firewall_hosts: List[str]
    """Hosts registered in the top-level ``firewall`` argument."""

    all_hosts: List[str]
    """All traffic — equivalent to ``["0.0.0.0/0"]``."""


SandboxNetworkSelector = Union[
    List[str],
    Callable[[SandboxNetworkSelectorContext], List[str]],
]
"""
Egress rule list, either a static list of CIDR blocks / IP addresses /
hostnames, or a callable that receives a :class:`SandboxNetworkSelectorContext`
and returns the same.
"""


class SandboxNetworkOpts(TypedDict):
    """
    Sandbox network configuration options.
    """

    allow_out: NotRequired[SandboxNetworkSelector]
    """
    Allow outbound traffic from the sandbox to the specified addresses.
    If ``allow_out`` is not specified, all outbound traffic is allowed.

    Accepts either a static list of CIDR blocks / IP addresses / hostnames, or
    a callable that receives a :class:`SandboxNetworkSelectorContext` and
    returns the same. ``ctx.firewall_hosts`` is the list of hosts registered
    in the top-level ``firewall`` argument; ``ctx.all_hosts`` is
    ``["0.0.0.0/0"]``.

    Examples:
    - Static list: ``["1.1.1.1", "8.8.8.0/24"]``
    - Allow only firewall-registered hosts:
      ``lambda ctx: ctx.firewall_hosts``
    """

    deny_out: NotRequired[SandboxNetworkSelector]
    """
    Deny outbound traffic from the sandbox to the specified addresses.

    Accepts the same shapes as ``allow_out``.

    Examples:
    - Static list: ``["1.1.1.1", "8.8.8.0/24"]``
    - Block all egress: ``lambda ctx: ctx.all_hosts``
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


class SandboxNetworkInfo(TypedDict, total=False):
    """
    Network configuration as returned by the sandbox info endpoint.
    Mirrors :class:`SandboxNetworkOpts` but with ``allow_out``/``deny_out``
    always materialized to plain string lists.
    """

    allow_out: List[str]
    deny_out: List[str]
    allow_public_traffic: bool
    mask_request_host: str


class SandboxLifecycle(TypedDict):
    """
    Sandbox lifecycle configuration; defines post-timeout behavior and auto-resume settings.
    Defaults to `on_timeout="kill"` and `auto_resume=False`.
    """

    on_timeout: Literal["pause", "kill"]
    """
    What should happen to the sandbox when timeout is reached. `"kill"` means the sandbox will be terminated, while `"pause"` means the sandbox will be paused and can be resumed later. Defaults to `"kill"`.
    """

    auto_resume: NotRequired[bool]
    """
    Whether activity should cause the sandbox to resume when paused. Defaults to `False`.
    Can be `True` only when `on_timeout` is `pause`.
    """


class SandboxInfoLifecycle(TypedDict):
    """
    Sandbox lifecycle configuration returned by sandbox info.
    """

    on_timeout: Literal["pause", "kill"]
    """
    What should happen to the sandbox when timeout is reached.
    """

    auto_resume: bool
    """
    Whether activity should cause the sandbox to resume when paused.
    """


_ALL_TRAFFIC_HOSTS: List[str] = [ALL_TRAFFIC]


def _resolve_network_selector(
    selector: Optional[SandboxNetworkSelector],
    firewall_hosts: List[str],
) -> Optional[List[str]]:
    if selector is None:
        return None

    if callable(selector):
        ctx = SandboxNetworkSelectorContext(
            firewall_hosts=firewall_hosts,
            all_hosts=list(_ALL_TRAFFIC_HOSTS),
        )
        return list(selector(ctx))

    return list(selector)


def build_network_config(
    network: Optional[SandboxNetworkOpts],
    firewall: Optional[SandboxFirewall],
) -> Optional[Dict[str, Any]]:
    """Resolve a :class:`SandboxNetworkOpts` into the dict the API expects."""
    if network is None:
        return None

    firewall_hosts = list(firewall.keys()) if firewall else []
    allow_out = _resolve_network_selector(network.get("allow_out"), firewall_hosts)
    deny_out = _resolve_network_selector(network.get("deny_out"), firewall_hosts)

    body: Dict[str, Any] = {}
    if allow_out is not None:
        body["allow_out"] = allow_out
    if deny_out is not None:
        body["deny_out"] = deny_out
    if "allow_public_traffic" in network:
        body["allow_public_traffic"] = network["allow_public_traffic"]
    if "mask_request_host" in network:
        body["mask_request_host"] = network["mask_request_host"]

    return body


def build_firewall_config(
    firewall: Optional[SandboxFirewall],
) -> Optional[ClientSandboxFirewall]:
    """Convert a :class:`SandboxFirewall` into the generated client model."""
    if firewall is None:
        return None

    from e2b.api.client.models import (
        SandboxFirewallRule as ClientSandboxFirewallRule,
        SandboxFirewallRuleTransform as ClientSandboxFirewallRuleTransform,
        SandboxFirewallRuleTransformHeaders as ClientSandboxFirewallRuleTransformHeaders,
    )

    client_firewall = ClientSandboxFirewall()
    for host, rules in firewall.items():
        client_rules: List[ClientSandboxFirewallRule] = []
        for rule in rules:
            transform = rule.get("transform")
            if transform is None:
                client_rules.append(ClientSandboxFirewallRule())
                continue

            client_transform = ClientSandboxFirewallRuleTransform()
            headers = transform.get("headers")
            if headers:
                client_headers = ClientSandboxFirewallRuleTransformHeaders()
                client_headers.additional_properties = dict(headers)
                client_transform.headers = client_headers

            client_rules.append(ClientSandboxFirewallRule(transform=client_transform))
        client_firewall.additional_properties[host] = client_rules

    return client_firewall


def get_auto_resume_enabled(lifecycle: Optional[SandboxLifecycle]) -> Optional[bool]:
    if lifecycle is None or lifecycle.get("on_timeout") != "pause":
        return None

    return lifecycle.get("auto_resume", False)


def from_client_network_config(
    network: Union[Unset, SandboxNetworkConfig],
) -> Optional[SandboxNetworkInfo]:
    if isinstance(network, Unset):
        return None

    result: SandboxNetworkInfo = {}

    if not isinstance(network.allow_out, Unset):
        result["allow_out"] = list(network.allow_out)
    if not isinstance(network.deny_out, Unset):
        result["deny_out"] = list(network.deny_out)
    if not isinstance(network.allow_public_traffic, Unset):
        result["allow_public_traffic"] = network.allow_public_traffic
    if not isinstance(network.mask_request_host, Unset):
        result["mask_request_host"] = network.mask_request_host

    return result


def from_client_firewall(
    firewall: Union[Unset, ClientSandboxFirewall],
) -> Optional[SandboxFirewall]:
    if isinstance(firewall, Unset):
        return None

    return cast(SandboxFirewall, firewall.to_dict())


def from_client_lifecycle(
    lifecycle: Union[Unset, ClientSandboxLifecycle],
) -> Optional[SandboxInfoLifecycle]:
    if isinstance(lifecycle, Unset):
        return None

    result: SandboxInfoLifecycle = {
        "on_timeout": cast(Literal["pause", "kill"], lifecycle.on_timeout),
        "auto_resume": lifecycle.auto_resume,
    }

    return result


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
    allow_internet_access: Optional[bool] = None
    """Whether internet access was explicitly enabled or disabled for the sandbox."""
    network: Optional[SandboxNetworkInfo] = None
    """Sandbox network configuration."""
    firewall: Optional[SandboxFirewall] = None
    """Per-host firewall rules registered for the sandbox."""
    lifecycle: Optional[SandboxInfoLifecycle] = None
    """Sandbox lifecycle configuration."""
    volume_mounts: List[Dict[str, str]] = field(default_factory=list)
    """Volume mounts for the sandbox."""

    @classmethod
    def _from_sandbox_data(
        cls,
        sandbox: Union[ListedSandbox, SandboxDetail],
        envd_access_token: Optional[str] = None,
        sandbox_domain: Optional[str] = None,
        allow_internet_access: Optional[bool] = None,
        network: Optional[SandboxNetworkInfo] = None,
        firewall: Optional[SandboxFirewall] = None,
        lifecycle: Optional[SandboxInfoLifecycle] = None,
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
            volume_mounts=[
                {"name": vm.name, "path": vm.path} for vm in sandbox.volume_mounts
            ]
            if not isinstance(sandbox.volume_mounts, Unset)
            else [],
            _envd_access_token=envd_access_token,
            allow_internet_access=allow_internet_access,
            network=network,
            firewall=firewall,
            lifecycle=lifecycle,
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
            allow_internet_access=(
                sandbox_detail.allow_internet_access
                if isinstance(sandbox_detail.allow_internet_access, bool)
                else None
            ),
            network=from_client_network_config(sandbox_detail.network),
            firewall=from_client_firewall(sandbox_detail.firewall),
            lifecycle=from_client_lifecycle(sandbox_detail.lifecycle),
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
