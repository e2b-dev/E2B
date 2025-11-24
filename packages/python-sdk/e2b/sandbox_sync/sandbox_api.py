import datetime
from typing import Dict, List, Optional

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
    post_sandboxes_sandbox_id_timeout,
)
from e2b.api.client.models import (
    ConnectSandbox,
    Error,
    NewSandbox,
    PostSandboxesSandboxIDTimeoutBody,
    Sandbox,
    SandboxNetworkConfig,
)
from e2b.api.client.types import UNSET
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException, SandboxException, TemplateException
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.sandbox_api import (
    McpServer,
    SandboxInfo,
    SandboxMetrics,
    SandboxNetworkOpts,
    SandboxQuery,
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
            raise NotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise SandboxException("Body of the request is None")

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
            raise NotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

    @classmethod
    def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        auto_pause: bool,
        allow_internet_access: bool,
        metadata: Optional[Dict[str, str]],
        env_vars: Optional[Dict[str, str]],
        secure: bool,
        mcp: Optional[McpServer] = None,
        network: Optional[SandboxNetworkOpts] = None,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_sandboxes.sync_detailed(
            body=NewSandbox(
                template_id=template,
                auto_pause=auto_pause,
                metadata=metadata or {},
                timeout=timeout,
                env_vars=env_vars or {},
                mcp=mcp or UNSET,
                secure=secure,
                allow_internet_access=allow_internet_access,
                network=SandboxNetworkConfig(**network) if network else UNSET,
            ),
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
                "You need to update the template to use the new SDK. "
                "You can do this by running `e2b template build` in the directory with the template."
            )

        return SandboxCreateResponse(
            sandbox_id=res.parsed.sandbox_id,
            sandbox_domain=res.parsed.domain,
            envd_version=res.parsed.envd_version,
            envd_access_token=res.parsed.envd_access_token,
            traffic_access_token=res.parsed.traffic_access_token,
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
            start=int(start.timestamp() * 1000) if start else None,
            end=int(end.timestamp() * 1000) if end else None,
            client=api_client,
        )

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
    ) -> Sandbox:
        timeout = timeout or SandboxBase.default_sandbox_timeout

        config = ConnectionConfig(**opts)

        api_client = get_api_client(
            config,
            headers={
                "E2b-Sandbox-Id": sandbox_id,
                "E2b-Sandbox-Port": str(config.envd_port),
            },
        )
        res = post_sandboxes_sandbox_id_connect.sync_detailed(
            sandbox_id,
            client=api_client,
            body=ConnectSandbox(timeout=timeout),
        )

        if res.status_code == 404:
            raise NotFoundException(f"Paused sandbox {sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return res.parsed

    @classmethod
    def _cls_pause(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> str:
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_sandboxes_sandbox_id_pause.sync_detailed(
            sandbox_id,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Sandbox {sandbox_id} not found")

        if res.status_code == 409:
            return sandbox_id

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return sandbox_id
