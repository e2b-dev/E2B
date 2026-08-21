import datetime
import logging
from typing import Any, Dict, List, Optional, Union, cast

from packaging.version import Version
from typing_extensions import Unpack

from e2b.api import (
    SandboxCreateResponse,
    api_exception_from_code,
    encode_path_param,
    handle_api_exception,
)
from e2b.api.client.api.sandboxes import (
    delete_sandboxes_sandbox_id,
    get_sandboxes_sandbox_id,
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes,
    post_sandboxes_sandbox_id_connect,
    post_sandboxes_sandbox_id_fork,
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
    SandboxSnapshotRequest,
    SandboxTimeoutRequest,
    SandboxForkRequest,
    SandboxNetworkConfig,
    SandboxPauseRequest,
    SandboxVolumeMount as SandboxVolumeMountAPI,
)
from e2b.api.client.types import UNSET, Unset
from e2b.api.client_async import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import (
    NotFoundException,
    SandboxException,
    SandboxNotFoundException,
    TemplateException,
)
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.sandbox_api import (
    build_network_update_body,
    McpServer,
    SandboxIamOpts,
    SandboxInfo,
    SandboxLifecycle,
    SandboxListOrder,
    SandboxMetrics,
    SandboxNetworkOpts,
    SandboxNetworkUpdate,
    SandboxQuery,
    SnapshotInfo,
    build_iam_config,
    build_lifecycle_config,
    build_network_config,
)
from e2b.sandbox_async.paginator import AsyncSandboxPaginator


class SandboxApi(SandboxBase):
    @classmethod
    def list(
        cls,
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        order: Optional[SandboxListOrder] = None,
        **opts: Unpack[ApiParams],
    ) -> AsyncSandboxPaginator:
        """
        List sandboxes.

        By default (no `query.state` set), returns sandboxes in both `running`
        and `paused` states. To filter by state, pass `query=SandboxQuery(state=[...])`.

        :param query: Filter the list of sandboxes by metadata, state, start time, or template, e.g. `SandboxQuery(metadata={"key": "value"})` or `SandboxQuery(state=[SandboxState.RUNNING])`
        :param limit: Maximum number of sandboxes to return per page
        :param next_token: Token for pagination
        :param order: Sort order of the list of sandboxes by start time, applied across the whole result set before pagination (not within a page), defaults to `"desc"` (newest first)

        :return: An `AsyncSandboxPaginator` that yields pages of sandboxes (running and paused by default). Iterate pages via `await paginator.next_items()` while `paginator.has_next` is True.
        """
        return AsyncSandboxPaginator(
            query=query,
            limit=limit,
            next_token=next_token,
            order=order,
            **cls._resolve_api_params(**opts),
        )

    @classmethod
    async def _cls_get_info(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID

        :return: Sandbox info
        """
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await get_sandboxes_sandbox_id.asyncio_detailed(
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
    async def _cls_kill(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        api_client = get_api_client(config)
        res = await delete_sandboxes_sandbox_id.asyncio_detailed(
            sandbox_id,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return True

    @classmethod
    async def _cls_set_timeout(
        cls,
        sandbox_id: str,
        timeout: int,
        **opts: Unpack[ApiParams],
    ) -> None:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        if config.debug:
            # Skip setting the timeout in debug mode
            return

        api_client = get_api_client(config)
        res = await post_sandboxes_sandbox_id_timeout.asyncio_detailed(
            sandbox_id,
            client=api_client,
            body=SandboxTimeoutRequest(timeout=timeout),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

    @classmethod
    async def _cls_update_network(
        cls,
        sandbox_id: str,
        network: SandboxNetworkUpdate,
        **opts: Unpack[ApiParams],
    ) -> None:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await put_sandboxes_sandbox_id_network.asyncio_detailed(
            sandbox_id,
            client=api_client,
            body=build_network_update_body(network),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

    @classmethod
    async def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        allow_internet_access: bool,
        metadata: Optional[Dict[str, str]],
        env_vars: Optional[Dict[str, str]],
        secure: bool,
        mcp: Optional[McpServer] = None,
        network: Optional[SandboxNetworkOpts] = None,
        iam: Optional[SandboxIamOpts] = None,
        lifecycle: Optional[SandboxLifecycle] = None,
        volume_mounts: Optional[List[SandboxVolumeMountAPI]] = None,
        logger: Optional[logging.Logger] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        params = cls._resolve_api_params(**opts)
        config = ConnectionConfig(logger=logger, **params)

        lifecycle_body = build_lifecycle_config(lifecycle)

        # Built before the network config: ``transform`` callables are resolved
        # against the workload tokens this request registers.
        iam_body = build_iam_config(iam)
        network_body = build_network_config(network, iam_body)
        body = NewSandbox(
            template_id=template,
            auto_pause=lifecycle_body.auto_pause,
            auto_pause_memory=lifecycle_body.auto_pause_memory,
            auto_resume=lifecycle_body.auto_resume,
            metadata=metadata or {},
            timeout=timeout,
            env_vars=env_vars or {},
            mcp=cast(Any, mcp) or UNSET,
            secure=secure,
            allow_internet_access=allow_internet_access,
            network=SandboxNetworkConfig(**network_body) if network_body else UNSET,
            iam=iam_body or UNSET,
            volume_mounts=volume_mounts if volume_mounts else UNSET,
        )

        api_client = get_api_client(config)
        res = await post_sandboxes.asyncio_detailed(
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
            await SandboxApi._cls_kill(res.parsed.sandbox_id, **params)
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
    async def _cls_get_metrics(
        cls,
        sandbox_id: str,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to the current time

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        api_client = get_api_client(config)
        res = await get_sandboxes_sandbox_id_metrics.asyncio_detailed(
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

        # Check if res.parse is Error
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
    async def _cls_create_snapshot(
        cls,
        sandbox_id: str,
        name: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> SnapshotInfo:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await post_sandboxes_sandbox_id_snapshots.asyncio_detailed(
            sandbox_id,
            client=api_client,
            body=SandboxSnapshotRequest(name=name if name else UNSET),
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
    async def _cls_delete_snapshot(
        cls,
        snapshot_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await delete_templates_template_id.asyncio_detailed(
            encode_path_param(snapshot_id),
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return True

    @classmethod
    async def _cls_pause(
        cls,
        sandbox_id: str,
        keep_memory: bool = True,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await post_sandboxes_sandbox_id_pause.asyncio_detailed(
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

    @classmethod
    async def _cls_fork(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        count: Optional[int] = None,
        logger: Optional[logging.Logger] = None,
        **opts: Unpack[ApiParams],
    ) -> List[Union[SandboxCreateResponse, Exception]]:
        timeout = (
            timeout if timeout is not None else SandboxBase.default_sandbox_timeout
        )
        count = count if count is not None else 1

        config = ConnectionConfig(logger=logger, **cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await post_sandboxes_sandbox_id_fork.asyncio_detailed(
            sandbox_id,
            client=api_client,
            body=SandboxForkRequest(timeout=timeout, count=count),
        )

        if res.status_code == 404:
            message = (
                res.parsed.message
                if isinstance(res.parsed, Error)
                else f"Sandbox {sandbox_id} not found"
            )
            raise SandboxNotFoundException(message)

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        if res.parsed is None:
            raise Exception("Body of the request is None")

        results: List[Union[SandboxCreateResponse, Exception]] = []
        for result in res.parsed:
            sandbox = None if isinstance(result.sandbox, Unset) else result.sandbox
            error = None if isinstance(result.error, Unset) else result.error

            if error is not None or sandbox is None:
                if error is None:
                    exception = SandboxException("Failed to start forked sandbox")
                elif error.code == 404:
                    # 404 is call-site-specific in the SDK, so
                    # api_exception_from_code leaves it to the caller. A
                    # per-fork 404 refers to a resource needed to start that
                    # fork (e.g. the snapshot) — not the source sandbox, which
                    # would have failed the whole request — so stay generic.
                    exception = NotFoundException(f"{error.code}: {error.message}")
                else:
                    exception = api_exception_from_code(error.code, error.message)
                results.append(exception)
                continue

            domain = sandbox.domain if isinstance(sandbox.domain, str) else None
            envd_token = (
                sandbox.envd_access_token
                if isinstance(sandbox.envd_access_token, str)
                else None
            )
            traffic_token = (
                sandbox.traffic_access_token
                if isinstance(sandbox.traffic_access_token, str)
                else None
            )

            results.append(
                SandboxCreateResponse(
                    sandbox_id=sandbox.sandbox_id,
                    sandbox_domain=domain,
                    envd_version=sandbox.envd_version,
                    envd_access_token=envd_token,
                    traffic_access_token=traffic_token,
                )
            )

        return results

    @classmethod
    async def _cls_connect(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        logger: Optional[logging.Logger] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        timeout = timeout or SandboxBase.default_sandbox_timeout

        # Sandbox is not running, resume it
        config = ConnectionConfig(logger=logger, **cls._resolve_api_params(**opts))

        api_client = get_api_client(config)
        res = await post_sandboxes_sandbox_id_connect.asyncio_detailed(
            sandbox_id,
            client=api_client,
            body=ConnectSandbox(timeout=timeout),
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Paused sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        # Check if res.parse is Error
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
