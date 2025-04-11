from dataclasses import dataclass
import urllib.parse
from typing import Dict, List, Optional, AsyncGenerator
from packaging.version import Version

from e2b.sandbox.sandbox_api import ListSandboxesResponse, SandboxInfo, SandboxApiBase
from e2b.exceptions import TemplateException
from e2b.api import AsyncApiClient, SandboxCreateResponse, handle_api_exception
from e2b.api.client.models import NewSandbox, PostSandboxesSandboxIDTimeoutBody
from e2b.api.client.api.sandboxes import (
    delete_sandboxes_sandbox_id,
    get_v2_sandboxes,
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
    post_sandboxes_sandbox_id_timeout,
)
from e2b.api.client.models import (
    NewSandbox,
    SandboxState,
    PostSandboxesSandboxIDTimeoutBody,
    ResumedSandbox,
)
from e2b.api.client.types import UNSET
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import TemplateException, NotFoundException
from e2b.sandbox.sandbox_api import SandboxApiBase, SandboxInfo, SandboxMetrics
from packaging.version import Version
from e2b.api import handle_api_exception


class SandboxApi(SandboxApiBase):
    @dataclass
    class SandboxQuery:
        """Query parameters for listing sandboxes."""

        metadata: Optional[dict[str, str]] = None
        """Filter sandboxes by metadata."""

        state: Optional[List[SandboxState]] = None
        """Filter sandboxes by state."""

    @classmethod
    async def list(
        cls,
        api_key: Optional[str] = None,
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> ListSandboxesResponse:
        """
        List sandboxes with pagination.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxQuery(metadata={"key": "value"})` or `SandboxQuery(state=["paused", "running"])`
        :param limit: Maximum number of sandboxes to return
        :param next_token: Token for pagination
        :param domain: Domain to use for the request, only relevant for self-hosted environments
        :param debug: Enable debug mode, all requested are then sent to localhost
        :param request_timeout: Timeout for the request in **seconds**

        :returns: ListSandboxesResponse containing sandboxes list, pagination info and iterator
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        # Convert filters to the format expected by the API
        metadata = None
        if query:
            if query.metadata:
                quoted_metadata = {
                    urllib.parse.quote(k): urllib.parse.quote(v)
                    for k, v in query.metadata.items()
                }
                metadata = urllib.parse.urlencode(quoted_metadata)

        async with AsyncApiClient(config) as api_client:
            res = await get_v2_sandboxes.asyncio_detailed(
                client=api_client,
                metadata=metadata,
                state=query.state or UNSET,
                limit=limit,
                next_token=next_token,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return ListSandboxesResponse(
                    sandboxes=[],
                    has_more_items=False,
                    next_token=None,
                    iterator=cls._list_iterator(query=query, api_key=api_key, domain=domain, debug=debug, request_timeout=request_timeout)
                )

            token = res.headers.get("x-next-token")
            has_more_items = bool(token)
            sandboxes = [
                SandboxInfo.from_listed_sandbox(sandbox)
                for sandbox in res.parsed
            ]

            return ListSandboxesResponse(
                sandboxes=sandboxes,
                has_more_items=has_more_items,
                next_token=token,
                iterator=cls._list_iterator(
                    limit=limit,
                    next_token=token,
                    query=query,
                    api_key=api_key,
                    domain=domain,
                    debug=debug,
                    request_timeout=request_timeout
                )
            )

    @classmethod
    async def _list_iterator(
        cls,
        query: Optional[SandboxQuery] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
    ) -> AsyncGenerator[SandboxInfo, None]:
        next_page = True
        token = next_token

        while next_page:
            result = await cls.list(
                query=query,
                api_key=api_key,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
                limit=limit,
                next_token=token,
            )

            next_page = result.has_more_items
            token = result.next_token

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
