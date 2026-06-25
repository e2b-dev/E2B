import datetime
from typing import Any, Dict, List, Optional, cast

from packaging.version import Version
from typing_extensions import Unpack

from e2b.api import SandboxCreateResponse, handle_api_exception
from e2b.api.client.api.sandboxes import (
    delete_sandboxes_sandbox_id,
    get_sandboxes_sandbox_id,
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes,
    post_sandboxes_sandbox_id_connect,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_snapshots,
    post_sandboxes_sandbox_id_timeout,
    put_sandboxes_sandbox_id_network,
)
from e2b.api.client.api.templates import delete_templates_template_id
from e2b.api.client.models import (
    ConnectSandbox,
    Error,
    NewSandbox,
    PostSandboxesSandboxIDSnapshotsBody,
    PostSandboxesSandboxIDTimeoutBody,
    SandboxAutoResumeConfig,
    SandboxNetworkConfig,
    SandboxPauseRequest,
    SandboxVolumeMount as SandboxVolumeMountAPI,
)
from e2b.api.client.types import UNSET
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import (
    InvalidArgumentException,
    SandboxException,
    SandboxNotFoundException,
    TemplateException,
)
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.sandbox_api import (
    build_network_update_body,
    McpServer,
    SandboxInfo,
    SandboxLifecycle,
    SandboxMetrics,
    SandboxNetworkOpts,
    SandboxNetworkUpdate,
    SandboxQuery,
    SnapshotInfo,
    build_network_config,
)
from e2b.sandbox_sync.paginator import SandboxPaginator, get_api_client


class SandboxApi(SandboxBase):
    @staticmethod
    def list(
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxPaginator:
        """
        List all running sandboxes.

        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxListQuery(metadata={"key": "value"})` or `SandboxListQuery(state=[SandboxState.RUNNING])`
        :param limit: Maximum number of sandboxes to return per page
        :param next_token: Token for pagination

        :return: List of running sandboxes
        """
        return SandboxPaginator(
            query=query,
            limit=limit,
            next_token=next_token,
            **opts,
        )

    @classmethod
    def _cls_get_info(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID

        :return: Sandbox info
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = get_sandboxes_sandbox_id.sync_detailed(
            sandbox_id,
            client=api_client,
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return SandboxInfo._from_sandbox_detail(res.parsed)

    @classmethod
    def _cls_kill(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        api_client = get_api_client(config)
        res = delete_sandboxes_sandbox_id.sync_detailed(
            sandbox_id,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return True

    @classmethod
    def _cls_set_timeout(
        cls,
        sandbox_id: str,
        timeout: int,
        **opts: Unpack[ApiParams],
    ) -> None:
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip setting timeout in debug mode
            return

        api_client = get_api_client(config)
        res = post_sandboxes_sandbox_id_timeout.sync_detailed(
            sandbox_id,
            client=api_client,
            body=PostSandboxesSandboxIDTimeoutBody(timeout=timeout),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

    @classmethod
    def _cls_update_network(
        cls,
        sandbox_id: str,
        network: SandboxNetworkUpdate,
        **opts: Unpack[ApiParams],
    ) -> None:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = put_sandboxes_sandbox_id_network.sync_detailed(
            sandbox_id,
            client=api_client,
            body=build_network_update_body(network),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

    @classmethod
    def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        allow_internet_access: bool,
        metadata: Optional[Dict[str, str]],
        env_vars: Optional[Dict[str, str]],
        secure: bool,
        mcp: Optional[McpServer] = None,
        network: Optional[SandboxNetworkOpts] = None,
        lifecycle: Optional[SandboxLifecycle] = None,
        volume_mounts: Optional[List[SandboxVolumeMountAPI]] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(**opts)

        # on_timeout accepts a bare action or {"action", "keep_memory"}; normalize.
        on_timeout_raw = lifecycle.get("on_timeout", "kill") if lifecycle else "kill"
        if isinstance(on_timeout_raw, str):
            on_timeout = on_timeout_raw
            keep_memory = None
            keep_memory_provided = False
        else:
            on_timeout = on_timeout_raw.get("action", "kill")
            keep_memory_provided = "keep_memory" in on_timeout_raw
            keep_memory = on_timeout_raw.get("keep_memory")

        # keep_memory only governs a pause action. The discriminated union type
        # forbids it on action="kill"; re-check at runtime for callers that
        # bypass the type.
        if keep_memory_provided and on_timeout != "pause":
            raise InvalidArgumentException(
                "keep_memory is only allowed when on_timeout action is 'pause'."
            )

        # A missing or explicit None keep_memory defaults to True (full memory),
        # mirroring the JS SDK; sending null would wrongly read as filesystem-only.
        if keep_memory is None:
            keep_memory = True
        auto_resume = lifecycle.get("auto_resume", False) if lifecycle else False

        if auto_resume and on_timeout != "pause":
            raise InvalidArgumentException(
                "auto_resume can only be True when on_timeout action is 'pause'."
            )

        if not keep_memory and auto_resume:
            raise InvalidArgumentException(
                "auto_resume: True is not a valid value when keep_memory: False - "
                "a filesystem-only snapshot cannot be auto-resumed by traffic and "
                "must be resumed explicitly using Sandbox.connect()."
            )

        network_body = build_network_config(network)
        body = NewSandbox(
            template_id=template,
            auto_pause=on_timeout == "pause",
            auto_pause_memory=keep_memory if on_timeout == "pause" else UNSET,
            auto_resume=SandboxAutoResumeConfig(enabled=auto_resume),
            metadata=metadata or {},
            timeout=timeout,
            env_vars=env_vars or {},
            mcp=cast(Any, mcp) or UNSET,
            secure=secure,
            allow_internet_access=allow_internet_access,
            network=SandboxNetworkConfig(**network_body) if network_body else UNSET,
            volume_mounts=volume_mounts if volume_mounts else UNSET,
        )

        api_client = get_api_client(config)
        res = post_sandboxes.sync_detailed(
            body=body,
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        if Version(res.parsed.envd_version) < Version("0.1.0"):
            SandboxApi._cls_kill(res.parsed.sandbox_id)
            raise TemplateException(
                "You need to update the template to use the new SDK."
            )

        domain = res.parsed.domain if isinstance(res.parsed.domain, str) else None
        envd_token = (
            res.parsed.envd_access_token
            if isinstance(res.parsed.envd_access_token, str)
            else None
        )
        traffic_token = (
            res.parsed.traffic_access_token
            if isinstance(res.parsed.traffic_access_token, str)
            else None
        )

        return SandboxCreateResponse(
            sandbox_id=res.parsed.sandbox_id,
            sandbox_domain=domain,
            envd_version=res.parsed.envd_version,
            envd_access_token=envd_token,
            traffic_access_token=traffic_token,
        )

    @classmethod
    def _cls_get_metrics(
        cls,
        sandbox_id: str,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        api_client = get_api_client(config)
        res = get_sandboxes_sandbox_id_metrics.sync_detailed(
            sandbox_id,
            start=int(start.timestamp()) if start else UNSET,
            end=int(end.timestamp()) if end else UNSET,
            client=api_client,
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        # Convert to typed SandboxMetrics objects
        return [
            SandboxMetrics(
                cpu_count=metric.cpu_count,
                cpu_used_pct=metric.cpu_used_pct,
                disk_total=metric.disk_total,
                disk_used=metric.disk_used,
                mem_total=metric.mem_total,
                mem_used=metric.mem_used,
                mem_cache=metric.mem_cache,
                timestamp=metric.timestamp,
            )
            for metric in res.parsed
        ]

    @classmethod
    def _cls_connect(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        timeout = timeout or SandboxBase.default_sandbox_timeout

        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_sandboxes_sandbox_id_connect.sync_detailed(
            sandbox_id,
            client=api_client,
            body=ConnectSandbox(timeout=timeout),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Paused sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        if res.parsed is None:
            raise Exception("Body of the request is None")

        domain = res.parsed.domain if isinstance(res.parsed.domain, str) else None
        envd_token = (
            res.parsed.envd_access_token
            if isinstance(res.parsed.envd_access_token, str)
            else None
        )
        traffic_token = (
            res.parsed.traffic_access_token
            if isinstance(res.parsed.traffic_access_token, str)
            else None
        )

        return SandboxCreateResponse(
            sandbox_id=res.parsed.sandbox_id,
            sandbox_domain=domain,
            envd_version=res.parsed.envd_version,
            envd_access_token=envd_token,
            traffic_access_token=traffic_token,
        )

    @classmethod
    def _cls_create_snapshot(
        cls,
        sandbox_id: str,
        name: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> SnapshotInfo:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_sandboxes_sandbox_id_snapshots.sync_detailed(
            sandbox_id,
            client=api_client,
            body=PostSandboxesSandboxIDSnapshotsBody(name=name if name else UNSET),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return SnapshotInfo(
            snapshot_id=res.parsed.snapshot_id,
            names=list(res.parsed.names) if res.parsed.names else [],
        )

    @classmethod
    def _cls_delete_snapshot(
        cls,
        snapshot_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = delete_templates_template_id.sync_detailed(
            snapshot_id,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return True

    @classmethod
    def _cls_pause(
        cls,
        sandbox_id: str,
        keep_memory: bool = True,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_sandboxes_sandbox_id_pause.sync_detailed(
            sandbox_id,
            client=api_client,
            body=SandboxPauseRequest(memory=keep_memory),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code == 409:
            # Sandbox is already paused
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        # Check if res.parse is Error
        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return True
