import urllib.parse
from typing import Dict, List, Optional
from packaging.version import Version

from e2b.sandbox.sandbox_api import SandboxInfo, SandboxApiBase, SandboxListQuery
from e2b.exceptions import TemplateException
from e2b.api import AsyncApiClient, SandboxCreateResponse, handle_api_exception
from e2b.api.client.models import NewSandbox, PostSandboxesSandboxIDTimeoutBody
from e2b.api.client.api.sandboxes import (
    get_sandboxes_sandbox_id,
    get_sandboxes_sandbox_id,
    post_sandboxes_sandbox_id_timeout,
    get_sandboxes,
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
    PostSandboxesSandboxIDTimeoutBody,
    ResumedSandbox,
)
from e2b.api.client.types import UNSET
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import TemplateException, NotFoundException
from e2b.sandbox.sandbox_api import SandboxApiBase, SandboxInfo, SandboxMetrics
from packaging.version import Version
from e2b.api import handle_api_exception
from e2b.api.client.models import Error


class AsyncSandboxPaginator:
    def __init__(
        self,
        query: Optional[SandboxListQuery] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
    ):
        self.query = query
        self.api_key = api_key
        self.domain = domain
        self.debug = debug
        self.request_timeout = request_timeout
        self.limit = limit
        self._has_next = True
        self._next_token = next_token

    @property
    def has_next(self) -> bool:
        return self._has_next

    @property
    def next_token(self) -> Optional[str]:
        return self._next_token

    async def next_items(self) -> List[SandboxInfo]:
        if not self.has_next:
            raise Exception("No more items to fetch")

        config = ConnectionConfig(
            api_key=self.api_key,
            domain=self.domain,
            debug=self.debug,
            request_timeout=self.request_timeout,
        )

        # Convert filters to the format expected by the API
        metadata = None
        if self.query and self.query.metadata:
            quoted_metadata = {
                urllib.parse.quote(k): urllib.parse.quote(v)
                for k, v in self.query.metadata.items()
            }
            metadata = urllib.parse.urlencode(quoted_metadata)

        async with AsyncApiClient(config) as api_client:
            res = await get_v2_sandboxes.asyncio_detailed(
                client=api_client,
                metadata=metadata if metadata else UNSET,
                limit=self.limit if self.limit else UNSET,
                next_token=self._next_token if self._next_token else UNSET,
            )

            if res.status_code >= 300 or isinstance(res.parsed, Error):
                raise handle_api_exception(res)

            self._next_token = res.headers.get("x-next-token")
            self._has_next = bool(self._next_token)

            if res.parsed is None:
                return []

            return [SandboxInfo.from_listed_sandbox(sandbox) for sandbox in res.parsed]


class SandboxApi(SandboxApiBase):
    @classmethod
    def list(
        cls,
        api_key: Optional[str] = None,
        query: Optional[SandboxListQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> AsyncSandboxPaginator:
        """
        List sandboxes with pagination.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxListQuery(metadata={"key": "value"})` or `SandboxListQuery(state=["paused", "running"])`
        :param limit: Maximum number of sandboxes to return
        :param next_token: Token for pagination
        :param domain: Domain to use for the request, only relevant for self-hosted environments
        :param debug: Enable debug mode, all requested are then sent to localhost
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param headers: Additional headers to send with the request

        :returns: SandboxPaginator
        """
        return AsyncSandboxPaginator(
            query=query,
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            limit=limit,
            next_token=next_token,
        )

    @classmethod
    async def get_info(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID
        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param domain: Domain to use for the request, defaults to `E2B_DOMAIN` environment variable
        :param debug: Debug mode, defaults to `E2B_DEBUG` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request

        :return: Sandbox info
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
        )

        async with AsyncApiClient(config) as api_client:
            res = await get_sandboxes_sandbox_id.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300 or isinstance(res.parsed, Error):
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            return SandboxInfo(
                sandbox_id=SandboxApi._get_sandbox_id(
                    res.parsed.sandbox_id,
                    res.parsed.client_id,
                ),
                template_id=res.parsed.template_id,
                name=res.parsed.alias if isinstance(res.parsed.alias, str) else None,
                metadata=(
                    res.parsed.metadata if isinstance(res.parsed.metadata, dict) else {}
                ),
                started_at=res.parsed.started_at,
                state=res.parsed.state,
            )

    @classmethod
    async def get_info(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID
        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param domain: Domain to use for the request, defaults to `E2B_DOMAIN` environment variable
        :param debug: Debug mode, defaults to `E2B_DEBUG` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request

        :return: Sandbox info
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
        )

        async with AsyncApiClient(config) as api_client:
            res = await get_sandboxes_sandbox_id.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300 or isinstance(res.parsed, Error):
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            return SandboxInfo(
                sandbox_id=SandboxApi._get_sandbox_id(
                    res.parsed.sandbox_id,
                    res.parsed.client_id,
                ),
                template_id=res.parsed.template_id,
                name=res.parsed.alias if isinstance(res.parsed.alias, str) else None,
                metadata=(
                    res.parsed.metadata if isinstance(res.parsed.metadata, dict) else {}
                ),
                started_at=res.parsed.started_at,
                state=res.parsed.state,
            )

    @classmethod
    async def _cls_kill(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
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
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
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

            if res.status_code >= 300 or isinstance(res.parsed, Error):
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
        auto_pause: bool,
        metadata: Optional[Dict[str, str]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
        )

        async with AsyncApiClient(config) as api_client:
            res = await post_sandboxes.asyncio_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    auto_pause=auto_pause,
                ),
                client=api_client,
            )

            if res.status_code >= 300 or isinstance(res.parsed, Error):
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
        auto_pause: bool,
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
                body=ResumedSandbox(timeout=timeout, auto_pause=auto_pause),
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
