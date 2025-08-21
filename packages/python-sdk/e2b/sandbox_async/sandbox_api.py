import datetime

from typing import Optional, Dict, List
from packaging.version import Version
from typing_extensions import Unpack

from e2b.api.client.types import UNSET
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.sandbox_api import SandboxInfo, SandboxMetrics, SandboxQuery
from e2b.exceptions import TemplateException, SandboxException, NotFoundException
from e2b.api import AsyncApiClient, SandboxCreateResponse
from e2b.api.client.models import (
    NewSandbox,
    PostSandboxesSandboxIDTimeoutBody,
    Error,
    ResumedSandbox,
)
from e2b.api.client.api.sandboxes import (
    get_sandboxes_sandbox_id,
    post_sandboxes_sandbox_id_timeout,
    delete_sandboxes_sandbox_id,
    post_sandboxes,
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
)
from e2b.connection_config import ConnectionConfig, ApiParams
from e2b.api import handle_api_exception
from e2b.sandbox_async.paginator import AsyncSandboxPaginator


class SandboxApi(SandboxBase):
    @staticmethod
    def list(
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> AsyncSandboxPaginator:
        """
        List all running sandboxes.

        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxListQuery(metadata={"key": "value"})` or `SandboxListQuery(state=[SandboxState.RUNNING])`
        :param limit: Maximum number of sandboxes to return per page
        :param next_token: Token for pagination

        :return: List of running sandboxes
        """
        return AsyncSandboxPaginator(
            query=query,
            limit=limit,
            next_token=next_token,
            **opts,
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
        config = ConnectionConfig(**opts)

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await get_sandboxes_sandbox_id.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

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
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
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
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip setting the timeout in debug mode
            return

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await post_sandboxes_sandbox_id_timeout.asyncio_detailed(
                sandbox_id,
                client=api_client,
                body=PostSandboxesSandboxIDTimeoutBody(timeout=timeout),
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

    @classmethod
    async def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        auto_pause: bool,
        allow_internet_access: bool,
        metadata: Optional[Dict[str, str]],
        env_vars: Optional[Dict[str, str]],
        secure: bool,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(**opts)

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await post_sandboxes.asyncio_detailed(
                body=NewSandbox(
                    template_id=template,
                    auto_pause=auto_pause,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    secure=secure,
                    allow_internet_access=allow_internet_access,
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
                await SandboxApi._cls_kill(res.parsed.sandbox_id)
                raise TemplateException(
                    "You need to update the template to use the new SDK. "
                    "You can do this by running `e2b template build` in the directory with the template."
                )

            return SandboxCreateResponse(
                sandbox_id=res.parsed.sandbox_id,
                sandbox_domain=res.parsed.domain,
                envd_version=res.parsed.envd_version,
                envd_access_token=res.parsed.envd_access_token,
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
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await get_sandboxes_sandbox_id_metrics.asyncio_detailed(
                sandbox_id,
                start=int(start.timestamp() * 1000) if start else UNSET,
                end=int(end.timestamp() * 1000) if end else UNSET,
                client=api_client,
            )

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
                    timestamp=metric.timestamp,
                )
                for metric in res.parsed
            ]

    @classmethod
    async def _cls_pause(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> str:
        config = ConnectionConfig(**opts)

        async with AsyncApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await post_sandboxes_sandbox_id_pause.asyncio_detailed(
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

    @classmethod
    async def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> bool:
        timeout = timeout or SandboxBase.default_sandbox_timeout

        # Temporary solution (02/12/2025),
        # Options discussed:
        # 1. No set - never sure how long the sandbox will be running
        # 2. Always set the timeout in code - the user can't just connect to the sandbox
        #       without changing the timeout, round trip to the server time
        # 3. Set the timeout in resume on backend - side effect on error
        # 4. Create new endpoint for connect
        try:
            await SandboxApi._cls_set_timeout(
                sandbox_id=sandbox_id,
                timeout=timeout,
                **opts,
            )
            return False
        except SandboxException:
            # Sandbox is not running, resume it
            config = ConnectionConfig(**opts)

            async with AsyncApiClient(
                config,
                limits=SandboxBase._limits,
            ) as api_client:
                res = await post_sandboxes_sandbox_id_resume.asyncio_detailed(
                    sandbox_id,
                    client=api_client,
                    body=ResumedSandbox(timeout=timeout),
                )

                if res.status_code == 404:
                    raise NotFoundException(f"Paused sandbox {sandbox_id} not found")

                if res.status_code == 409:
                    return False

                if res.status_code >= 300:
                    raise handle_api_exception(res)

                return True
