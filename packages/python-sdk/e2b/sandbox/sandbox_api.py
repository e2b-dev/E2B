import inspect
from dataclasses import dataclass, field
from datetime import datetime
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    List,
    Literal,
    Mapping,
    Optional,
    TypedDict,
    Union,
    cast,
)

from typing_extensions import NotRequired, Unpack

from e2b.api.client.models import (
    ListedSandbox,
    SandboxDetail,
    SandboxState,
)
from e2b.api.client.models import (
    SandboxLifecycle as ClientSandboxLifecycle,
)
from e2b.api.client.models import (
    SandboxNetworkConfig as ClientSandboxNetworkConfig,
)
from e2b.api.client.models import (
    SandboxNetworkConfigRules,
)
from e2b.api.client.models import (
    SandboxNetworkRule as ClientSandboxNetworkRule,
)
from e2b.api.client.models import (
    SandboxNetworkTransform as ClientSandboxNetworkTransform,
)
from e2b.api.client.models import (
    SandboxNetworkTransformHeaders as ClientSandboxNetworkTransformHeaders,
)
from e2b.api.client.models import (
    SandboxIam as ClientSandboxIam,
)
from e2b.api.client.models import (
    SandboxIamToken as ClientSandboxIamToken,
)
from e2b.api.client.models import (
    SandboxIamTokens as ClientSandboxIamTokens,
)
from e2b.api.client.models import (
    SandboxNetworkUpdateConfig,
)
from e2b.api.client.models import (
    SandboxNetworkUpdateConfigRules,
)
from e2b.api.client.types import Unset
from e2b.connection_config import ApiParams
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.mcp import McpServer as BaseMcpServer
from e2b.sandbox.iam import (
    IamTokenPlaceholders,
    validate_iam_token_name,
)
from e2b.sandbox.network import ALL_TRAFFIC
from e2b.paginator import PaginatorBase


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


class SandboxNetworkTransform(TypedDict):
    """
    Transform applied to egress requests matching a :class:`SandboxNetworkRule`.
    """

    headers: NotRequired[Dict[str, str]]
    """
    Headers to inject into the outbound request. Values override any headers
    already present on the request.
    """


@dataclass(frozen=True)
class _SandboxNetworkTransformIam:
    """Workload identity placeholders."""

    tokens: Mapping[str, str]
    """
    Placeholder for each workload token registered in
    :attr:`SandboxOpts.iam`, keyed by token name. ``tokens["aws"]`` is the
    string ``"${e2b.identity.tokens.aws}"``, which the egress proxy replaces
    with a freshly minted token when it forwards the request.

    Reading a name that is not registered raises
    :class:`InvalidArgumentException` — the proxy never turns an unregistered
    name into a token, so a typo would surface as a confusing auth failure at
    the destination.
    """


@dataclass(frozen=True)
class SandboxNetworkTransformContext:
    """
    Context passed to a :class:`SandboxNetworkRule` ``transform`` callable. Its
    values are literal placeholder strings that the egress proxy resolves per
    request, so the secret itself never leaves the platform.
    """

    iam: _SandboxNetworkTransformIam
    """Workload identity placeholders."""


SandboxNetworkTransformResolver = Callable[
    [SandboxNetworkTransformContext], SandboxNetworkTransform
]
"""
Callable form of ``SandboxNetworkRule.transform``. Invoked once while the
request is being built, with a context of placeholder strings.
"""


class SandboxNetworkRule(TypedDict):
    """
    Per-domain rule applied to egress requests.
    """

    transform: NotRequired[
        Union[SandboxNetworkTransform, SandboxNetworkTransformResolver]
    ]
    """
    Transform applied to requests matching this rule.

    Accepts either a static :class:`SandboxNetworkTransform` or a callable that
    receives a :class:`SandboxNetworkTransformContext` of placeholder strings —
    use the callable to inject a workload identity token the proxy mints per
    request::

        {
            "transform": lambda ctx: {
                "headers": {"Authorization": f"Bearer {ctx.iam.tokens['aws']}"},
            },
        }
    """


SandboxNetworkRules = Dict[str, List[SandboxNetworkRule]]
"""
Map of host (or CIDR / IP) to ordered list of rules applied to outbound
requests for that host. Registering a host here does not allow egress on its
own — the host must also appear in ``SandboxNetworkOpts.allow_out``.
"""


class SandboxNetworkRuleInfo(TypedDict):
    """
    Per-domain rule as returned by the sandbox info endpoint. Mirrors
    :class:`SandboxNetworkRule` but with ``transform`` always materialized to
    the static :class:`SandboxNetworkTransform` shape — no callable variant.
    """

    transform: NotRequired[SandboxNetworkTransform]


@dataclass(frozen=True)
class SandboxNetworkSelectorContext:
    """
    Context passed to ``allow_out``/``deny_out`` callables.
    """

    all_traffic: str
    """All traffic sentinel — equivalent to ``"0.0.0.0/0"``."""

    rules: Mapping[str, List[SandboxNetworkRule]]
    """Rules registered in :attr:`SandboxNetworkOpts.rules`."""


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
    returns the same. ``ctx.all_traffic`` is ``"0.0.0.0/0"``; ``ctx.rules`` is
    a read-only view of :attr:`rules`.

    Examples:
    - Static list: ``["1.1.1.1", "8.8.8.0/24"]``
    - Allow only rule-registered hosts:
      ``lambda ctx: list(ctx.rules.keys())``
    """

    deny_out: NotRequired[SandboxNetworkSelector]
    """
    Deny outbound traffic from the sandbox to the specified addresses.

    Accepts the same shapes as ``allow_out``.

    Examples:
    - Static list: ``["1.1.1.1", "8.8.8.0/24"]``
    - Block all egress: ``lambda ctx: [ctx.all_traffic]``
    """

    rules: NotRequired[SandboxNetworkRules]
    """
    Per-domain transform rules applied to matching egress HTTP/HTTPS
    requests. Keys are domains (e.g. ``"api.example.com"``); values are
    ordered lists of :class:`SandboxNetworkRule`.

    Registering a host here does not allow egress on its own — the host must
    also appear in ``allow_out``. Hosts registered here are exposed to the
    ``allow_out``/``deny_out`` callables via ``ctx.rules``.

    A rule's ``transform`` can also be a callable receiving a
    :class:`SandboxNetworkTransformContext`, which is how a workload identity
    token from :attr:`SandboxOpts.iam` gets injected without the SDK ever
    seeing its value::

        rules={
            "api.internal.example.com": [
                {
                    "transform": lambda ctx: {
                        "headers": {
                            "Authorization": f"Bearer {ctx.iam.tokens['aws']}",
                        },
                    },
                },
            ],
        }
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


class SandboxNetworkUpdate(TypedDict, total=False):
    """
    Subset of :class:`SandboxNetworkOpts` accepted by ``Sandbox.update_network``.
    The update endpoint replaces all egress rules atomically — fields that are
    omitted are cleared on the server.
    """

    allow_out: SandboxNetworkSelector
    """See :attr:`SandboxNetworkOpts.allow_out`."""

    deny_out: SandboxNetworkSelector
    """See :attr:`SandboxNetworkOpts.deny_out`."""

    rules: SandboxNetworkRules
    """
    See :attr:`SandboxNetworkOpts.rules`. A ``transform`` callable works here
    too, but the update payload carries no ``iam`` config, so token names cannot
    be checked against the sandbox's registered tokens — every name resolves to
    its placeholder and a typo only surfaces at the destination.
    """

    allow_internet_access: bool
    """
    Allow sandbox to access the internet. When set to ``False``, it behaves the
    same as specifying ``deny_out=["0.0.0.0/0"]`` in the network config.
    """


SandboxIamTokenType = Union[Literal["JWT-SVID"], str]
"""
Workload token type. ``"JWT-SVID"`` is the only type the API accepts in this
version; the set is defined server-side and may grow, so any string is allowed.
"""


class SandboxIamToken(TypedDict):
    """
    Workload token definition for sandbox workload identity.
    """

    audience: str
    """Audience of the workload token, stored exactly as provided."""

    token_type: SandboxIamTokenType
    """Workload token type."""


class SandboxIamOpts(TypedDict, total=False):
    """
    Sandbox workload identity configuration. A non-empty ``tokens`` map enables
    workload identity for the sandbox.
    """

    tokens: Dict[str, SandboxIamToken]
    """
    Named workload-token definitions, keyed by a caller-chosen token name.
    Values can be created with :meth:`Secret.iam_token`.

    A name is interpolated into the ``"${e2b.identity.tokens.<name>}"``
    placeholder a network transform resolves, so it cannot be empty or contain
    ``{``, ``}`` or control characters.
    """


class SandboxNetworkInfo(TypedDict, total=False):
    """
    Network configuration as returned by the sandbox info endpoint.
    Mirrors :class:`SandboxNetworkOpts` but with ``allow_out``/``deny_out``
    always materialized to plain string lists.
    """

    allow_out: List[str]
    deny_out: List[str]
    rules: Dict[str, List[SandboxNetworkRuleInfo]]
    allow_public_traffic: bool
    mask_request_host: str


class SandboxOnTimeoutPause(TypedDict):
    """
    Object form of `on_timeout` that auto-pauses the sandbox when the timeout is
    reached, optionally controlling the pause snapshot kind via `keep_memory`.
    """

    action: Literal["pause"]
    """Auto-pause the sandbox when the timeout is reached."""

    keep_memory: NotRequired[bool]
    """
    Whether the timeout auto-pause keeps a full memory snapshot. Defaults to `True`.
    When `False`, the auto-pause drops the in-memory state and persists only the
    filesystem (a filesystem-only snapshot); resuming such a sandbox cold-boots
    (reboots) it from disk, losing running processes and open connections.

    Cannot be combined with `auto_resume`: auto-resume wakes a paused sandbox on
    inbound traffic by restoring its memory snapshot in place, so the request that
    woke it hits an already-running process. A filesystem-only snapshot has no
    memory to restore — resuming cold-boots it — so it can't be woken transparently
    by traffic and must be resumed explicitly via `connect()`.
    """


class SandboxOnTimeoutKill(TypedDict):
    """
    Object form of `on_timeout` that kills the sandbox when the timeout is reached.
    """

    action: Literal["kill"]
    """Kill the sandbox when the timeout is reached."""


SandboxOnTimeout = Union[
    Literal["pause", "kill"], SandboxOnTimeoutPause, SandboxOnTimeoutKill
]
"""
What should happen to the sandbox when the timeout is reached. Either the bare
action (`"pause"` / `"kill"`) or the object form. The object form is a
discriminated union on `action`: `keep_memory` is only accepted alongside
`action: "pause"`. Passing `keep_memory` with `action: "kill"` is a static type
error.
"""


class SandboxLifecycle(TypedDict):
    """
    Sandbox lifecycle configuration; defines post-timeout behavior and auto-resume settings.
    Defaults to `on_timeout="kill"` and `auto_resume=False`.
    """

    on_timeout: SandboxOnTimeout
    """
    What should happen to the sandbox when timeout is reached. `"kill"` terminates
    the sandbox; `"pause"` pauses it for later resume. Accepts either the bare
    action or an object `{"action": "pause", "keep_memory": ...}` /
    `{"action": "kill"}` to also control the pause snapshot kind. Defaults to
    `"kill"`.
    """

    auto_resume: NotRequired[bool]
    """
    Whether activity should cause the sandbox to resume when paused. Defaults to `False`.
    Can be `True` only when `on_timeout` is `pause`. Not supported when
    `keep_memory` is `False` (a filesystem-only snapshot must be resumed
    explicitly via `connect()`).
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


def _resolve_network_selector(
    selector: Optional[SandboxNetworkSelector],
    rules: Mapping[str, List[SandboxNetworkRule]],
) -> Optional[List[str]]:
    if selector is None:
        return None

    if callable(selector):
        ctx = SandboxNetworkSelectorContext(all_traffic=ALL_TRAFFIC, rules=rules)
        return list(selector(ctx))

    return list(selector)


def _build_transform_context(
    token_names: Iterable[str],
    *,
    validate: bool,
) -> SandboxNetworkTransformContext:
    """
    Build the context handed to ``transform`` callables.

    ``token_names`` are the workload tokens the request registers; see
    :class:`_IamTokenPlaceholders` for what ``validate`` controls.
    """
    return SandboxNetworkTransformContext(
        iam=_SandboxNetworkTransformIam(
            tokens=IamTokenPlaceholders(token_names, validate=validate),
        ),
    )


def _build_client_rules(
    rules: SandboxNetworkRules,
    ctx: SandboxNetworkTransformContext,
) -> SandboxNetworkConfigRules:
    client_rules = SandboxNetworkConfigRules()
    for host, host_rules in rules.items():
        converted: List[ClientSandboxNetworkRule] = []
        for rule in host_rules:
            transform = rule.get("transform")
            if transform is None:
                converted.append(ClientSandboxNetworkRule())
                continue

            if callable(transform):
                transform = transform(ctx)
                # A callable that returns something other than a transform
                # resolves to no headers at all, which would silently create the
                # rule without the headers it is for.
                if inspect.isawaitable(transform):
                    if inspect.iscoroutine(transform):
                        # Close it so the caller does not also get a
                        # "coroutine was never awaited" RuntimeWarning.
                        transform.close()
                    raise InvalidArgumentException(
                        f"Network transform callable for {host!r} must be "
                        "synchronous, it returned an awaitable. Resolve the "
                        "value before creating the sandbox."
                    )
                if not isinstance(transform, Mapping):
                    raise InvalidArgumentException(
                        f"Network transform callable for {host!r} must return a "
                        f"transform dict, got {type(transform).__name__}."
                    )

            client_transform = ClientSandboxNetworkTransform()
            headers = transform.get("headers")
            if headers:
                # Require string values before they reach the wire — a non-string
                # would be dropped or mis-serialized, and mirrors the JS SDK's
                # validateTransformHeaders (which also coerces stand-ins for the
                # runtime-probed names).
                for header_name, header_value in headers.items():
                    if not isinstance(header_value, str):
                        raise InvalidArgumentException(
                            f"Network transform callable for {host!r} returned a "
                            f"non-string value for header {header_name!r}, got "
                            f"{type(header_value).__name__}."
                        )
                client_headers = ClientSandboxNetworkTransformHeaders()
                client_headers.additional_properties = dict(headers)
                client_transform.headers = client_headers

            converted.append(ClientSandboxNetworkRule(transform=client_transform))
        client_rules.additional_properties[host] = converted

    return client_rules


def _build_network_egress(
    network: Mapping[str, Any],
    ctx: SandboxNetworkTransformContext,
) -> Dict[str, Any]:
    """
    Resolve the shared egress fields (``allow_out`` / ``deny_out`` / per-host
    ``rules``) used by both the create and update endpoints. ``rules`` in the
    returned dict is the inner ``Dict[host, List[ClientSandboxNetworkRule]]``
    — callers wrap it in their endpoint-specific rules attrs class.
    """
    rules = network.get("rules") or {}
    allow_out = _resolve_network_selector(network.get("allow_out"), rules)
    deny_out = _resolve_network_selector(network.get("deny_out"), rules)

    body: Dict[str, Any] = {}
    if allow_out is not None:
        body["allow_out"] = allow_out
    if deny_out is not None:
        body["deny_out"] = deny_out
    if "rules" in network and network["rules"] is not None:
        body["rules"] = _build_client_rules(network["rules"], ctx).additional_properties

    return body


def build_network_config(
    network: Optional[SandboxNetworkOpts],
    iam: Optional[ClientSandboxIam] = None,
) -> Optional[Dict[str, Any]]:
    """Resolve a :class:`SandboxNetworkOpts` into the dict the API expects.

    ``iam`` is the built workload identity config of the same request — its
    token names are what ``transform`` callables may reference.
    """
    if network is None:
        return None

    token_names: List[str] = []
    if iam is not None and not isinstance(iam.tokens, Unset):
        token_names = iam.tokens.additional_keys

    body = _build_network_egress(
        network,
        _build_transform_context(token_names, validate=True),
    )
    if "rules" in body:
        client_rules = SandboxNetworkConfigRules()
        client_rules.additional_properties = body["rules"]
        body["rules"] = client_rules
    if "allow_public_traffic" in network:
        body["allow_public_traffic"] = network["allow_public_traffic"]
    if "mask_request_host" in network:
        body["mask_request_host"] = network["mask_request_host"]

    return body


def build_iam_config(
    iam: Optional[SandboxIamOpts],
) -> Optional[ClientSandboxIam]:
    """Resolve a :class:`SandboxIamOpts` into the API client body.

    Returns ``None`` for a config with no tokens — only a non-empty tokens
    map enables workload identity, so an empty config is omitted from the
    request payload entirely.
    """
    if iam is None:
        return None

    tokens = iam.get("tokens")
    if not tokens:
        return None

    client_tokens = ClientSandboxIamTokens()
    for name, token in tokens.items():
        # Re-check at runtime for callers that bypass the TypedDict — a bare
        # KeyError from deep inside create would not name the option or the
        # snake_case key the wire's camelCase 'tokenType' maps to.
        if (
            not isinstance(token, dict)
            or not isinstance(token.get("audience"), str)
            or not isinstance(token.get("token_type"), str)
        ):
            raise InvalidArgumentException(
                f"iam token {name!r} must be a dict with string 'audience' and "
                "'token_type' values (snake_case 'token_type', not 'tokenType')."
            )

        # A network transform placeholder is the only way to consume a workload
        # token, so a name that cannot appear in one is rejected where it is
        # registered rather than at the reference that would have used it.
        validate_iam_token_name(name)

        client_tokens[name] = ClientSandboxIamToken(
            audience=token["audience"],
            token_type=token["token_type"],
        )

    body = ClientSandboxIam()
    body.tokens = client_tokens
    return body


def build_network_update_body(
    network: SandboxNetworkUpdate,
) -> SandboxNetworkUpdateConfig:
    """Resolve a :class:`SandboxNetworkUpdate` into the API client body."""
    egress = _build_network_egress(
        network, _build_transform_context([], validate=False)
    )

    body = SandboxNetworkUpdateConfig()
    if "allow_out" in egress:
        body.allow_out = egress["allow_out"]
    if "deny_out" in egress:
        body.deny_out = egress["deny_out"]
    if "rules" in egress:
        rules = SandboxNetworkUpdateConfigRules()
        rules.additional_properties = egress["rules"]
        body.rules = rules
    if "allow_internet_access" in network:
        body.allow_internet_access = network["allow_internet_access"]

    return body


def from_client_network_config(
    network: Union[Unset, ClientSandboxNetworkConfig],
) -> Optional[SandboxNetworkInfo]:
    if isinstance(network, Unset):
        return None

    result: SandboxNetworkInfo = {}

    if not isinstance(network.allow_out, Unset):
        result["allow_out"] = list(network.allow_out)
    if not isinstance(network.deny_out, Unset):
        result["deny_out"] = list(network.deny_out)
    if not isinstance(network.rules, Unset):
        result["rules"] = cast(
            Dict[str, List[SandboxNetworkRuleInfo]], network.rules.to_dict()
        )
    if not isinstance(network.allow_public_traffic, Unset):
        result["allow_public_traffic"] = network.allow_public_traffic
    if not isinstance(network.mask_request_host, Unset):
        result["mask_request_host"] = network.mask_request_host

    return result


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
    allow_internet_access: Optional[bool] = None
    """Whether internet access was explicitly enabled or disabled for the sandbox."""
    network: Optional[SandboxNetworkInfo] = None
    """Sandbox network configuration."""
    lifecycle: Optional[SandboxInfoLifecycle] = None
    """Sandbox lifecycle configuration."""
    volume_mounts: List[Dict[str, str]] = field(default_factory=list)
    """Volume mounts for the sandbox."""

    @classmethod
    def _from_sandbox_data(
        cls,
        sandbox: Union[ListedSandbox, SandboxDetail],
        sandbox_domain: Optional[str] = None,
        allow_internet_access: Optional[bool] = None,
        network: Optional[SandboxNetworkInfo] = None,
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
            allow_internet_access=allow_internet_access,
            network=network,
            lifecycle=lifecycle,
        )

    @classmethod
    def _from_listed_sandbox(cls, listed_sandbox: ListedSandbox):
        return cls._from_sandbox_data(listed_sandbox)

    @classmethod
    def _from_sandbox_detail(cls, sandbox_detail: SandboxDetail):
        return cls._from_sandbox_data(
            sandbox_detail,
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
    mem_cache: int
    """Cached memory (page cache) in bytes."""
    timestamp: datetime
    """Timestamp of the metric entry."""


@dataclass
class SnapshotInfo:
    """Information about a snapshot."""

    snapshot_id: str
    """Snapshot identifier — template ID with tag, or namespaced name with tag (e.g. my-snapshot:latest). Can be used with Sandbox.create() to create a new sandbox from this snapshot."""
    names: List[str] = field(default_factory=list)
    """Full names of the snapshot template including project slug and tag (e.g. project-slug/my-snapshot:v2)."""


class SnapshotPaginatorBase(PaginatorBase[SnapshotInfo, ApiParams]):
    def __init__(
        self,
        sandbox_id: Optional[str] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        name: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        super().__init__(limit=limit, next_token=next_token, **opts)
        self.sandbox_id = sandbox_id
        self.name = name


class SandboxPaginatorBase(PaginatorBase[SandboxInfo, ApiParams]):
    def __init__(
        self,
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        super().__init__(limit=limit, next_token=next_token, **opts)
        self.query = query
