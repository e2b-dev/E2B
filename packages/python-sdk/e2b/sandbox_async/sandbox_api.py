import urllib.parse
from typing import Dict, List, Optional, Generator

from e2b.api import AsyncApiClient, SandboxCreateResponse, handle_api_exception
from e2b.api.client.api.sandboxes import (
    delete_sandboxes_sandbox_id,
    get_sandboxes,
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
    post_sandboxes_sandbox_id_timeout,
)
from e2b.api.client.models import (
    NewSandbox,
    PostSandboxesSandboxIDTimeoutBody,
    ResumedSandbox,
)
from e2b.api.client.models import SandboxState
from e2b.api.client.types import UNSET, Unset
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import TemplateException, NotFoundException
from e2b.sandbox.sandbox_api import SandboxApiBase, SandboxInfo, SandboxMetrics
from packaging.version import Version


class ListSandboxesResponse:
    def __init__(self, sandboxes: List[SandboxInfo], has_more_items: bool, cursor: Optional[str], iterator: Generator[SandboxInfo, None, None]):
        self.sandboxes = sandboxes
        self.has_more_items = has_more_items
        self.cursor = cursor
        self.iterator = iterator


class SandboxApi(SandboxApiBase):
    @classmethod
    async def list(
        cls,
        api_key: Optional[str] = None,
        filters: Optional[Dict[str, str]] = None,
        state: Optional[List[SandboxState]] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ):
        """
        List sandboxes with pagination.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param filters: Filter the list of sandboxes by metadata, e.g. `{"key": "value"}`, if there are multiple filters they are combined with AND.
        :param state: Filter the list of sandboxes by state, e.g. `['paused', 'running']`
        :param domain: Domain to use for the request, only relevant for self-hosted environments
        :param debug: Enable debug mode, all requested are then sent to localhost
        :param request_timeout: Timeout for the request in **seconds**
        :param limit: Maximum number of sandboxes to return
        :param cursor: Cursor for pagination

        :returns: Dictionary containing sandboxes list, pagination info and iterator
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        query = UNSET
        if filters:
            filters = {
                urllib.parse.quote(k): urllib.parse.quote(v) for k, v in filters.items()
            }
            query = urllib.parse.urlencode(filters)

        async with AsyncApiClient(config) as api_client:
            res = await get_sandboxes.asyncio_detailed(
                client=api_client,
                query=query,
                state=state or UNSET,
                limit=limit,
                cursor=cursor,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return ListSandboxesResponse(
                    sandboxes=[],
                    has_more_items=False,
                    cursor=None,
                    iterator=cls._list_iterator(filters=filters, state=state, api_key=api_key, domain=domain, debug=debug, request_timeout=request_timeout)
                )

            has_more_items = res.headers.get("x-has-more-items") == "true"
            next_cursor = res.headers.get("x-cursor")

            sandboxes = [
                SandboxInfo(
                    sandbox_id=SandboxApi._get_sandbox_id(
                        sandbox.sandbox_id,
                        sandbox.client_id,
                    ),
                    template_id=sandbox.template_id,
                    name=sandbox.alias if isinstance(sandbox.alias, str) else None,
                    metadata=(
                        sandbox.metadata if isinstance(sandbox.metadata, dict) else {}
                    ),
                    started_at=sandbox.started_at,
                    state=sandbox.state,
                )
                for sandbox in res.parsed
            ]

            return ListSandboxesResponse(
                sandboxes=sandboxes,
                has_more_items=has_more_items,
                cursor=next_cursor,
                iterator=cls._list_iterator(
                    limit=limit,
                    cursor=next_cursor,
                    filters=filters,
                    state=state,
                    api_key=api_key,
                    domain=domain,
                    debug=debug,
                    request_timeout=request_timeout
                )
            )

    @classmethod
    async def _list_iterator(
        cls,
        filters: Optional[Dict[str, str]] = None,
        state: Optional[List[SandboxState]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ):
        next_page = True
        next_cursor = cursor

        while next_page:
            result = await cls.list(
                filters=filters,
                state=state,
                api_key=api_key,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
                limit=limit,
                cursor=next_cursor,
            )

            next_page = result.has_more_items
            next_cursor = result.cursor

            for sandbox in result.sandboxes:
                yield sandbox

    @classmethod
    async def _cls_kill(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        async with AsyncApiClient(config) as api_client:
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
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> None:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if config.debug:
            # Skip setting the timeout in debug mode
            return

        async with AsyncApiClient(config) as api_client:
            res = await post_sandboxes_sandbox_id_timeout.asyncio_detailed(
                sandbox_id,
                client=api_client,
                body=PostSandboxesSandboxIDTimeoutBody(timeout=timeout),
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

    @classmethod
    async def _cls_get_metrics(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        async with AsyncApiClient(config) as api_client:
            res = await get_sandboxes_sandbox_id_metrics.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            return [
                SandboxMetrics(
                    timestamp=metric.timestamp,
                    cpu_used_pct=metric.cpu_used_pct,
                    cpu_count=metric.cpu_count,
                    mem_used_mib=metric.mem_used_mi_b,
                    mem_total_mib=metric.mem_total_mi_b,
                )
                for metric in res.parsed
            ]

    @classmethod
    async def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        metadata: Optional[Dict[str, str]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        async with AsyncApiClient(config) as api_client:
            res = await post_sandboxes.asyncio_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                ),
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            if Version(res.parsed.envd_version) < Version("0.1.0"):
                await SandboxApi._cls_kill(
                    SandboxApi._get_sandbox_id(
                        res.parsed.sandbox_id,
                        res.parsed.client_id,
                    )
                )
                raise TemplateException(
                    "You need to update the template to use the new SDK. "
                    "You can do this by running `e2b template build` in the directory with the template."
                )

            return SandboxCreateResponse(
                sandbox_id=SandboxApi._get_sandbox_id(
                    res.parsed.sandbox_id,
                    res.parsed.client_id,
                ),
                envd_version=res.parsed.envd_version,
            )

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"

    @classmethod
    async def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        async with AsyncApiClient(config) as api_client:
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

    @classmethod
    async def _cls_pause(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        async with AsyncApiClient(config) as api_client:
            res = await post_sandboxes_sandbox_id_pause.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code == 404:
                raise NotFoundException(f"Sandbox {sandbox_id} not found")

            if res.status_code == 409:
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True
