import urllib.parse

from typing import Optional, Dict, List
from packaging.version import Version


from e2b.sandbox.sandbox_api import (
    SandboxInfo,
    SandboxApiBase,
    SandboxListQuery,
    SandboxInfo,
)
from e2b.exceptions import TemplateException
from e2b.api import AsyncApiClient, SandboxCreateResponse
from e2b.api.client.models import NewSandbox, PostSandboxesSandboxIDTimeoutBody
from e2b.api.client.api.sandboxes import (
    get_sandboxes_sandbox_id,
    post_sandboxes_sandbox_id_timeout,
    delete_sandboxes_sandbox_id,
    post_sandboxes,
    get_v2_sandboxes,
)
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.api import handle_api_exception


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
                metadata=metadata,
                state=self.query.state if self.query else UNSET,
                limit=self.limit,
                next_token=self._next_token,
            )

            if res.status_code >= 300:
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
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID
        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param domain: Domain to use for the request, defaults to `E2B_DOMAIN` environment variable
        :param debug: Debug mode, defaults to `E2B_DEBUG` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param proxy: Proxy to use for the request

        :return: Sandbox info
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        async with AsyncApiClient(
            config,
            limits=SandboxApiBase._limits,
        ) as api_client:
            res = await get_sandboxes_sandbox_id.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
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
                end_at=res.parsed.end_at,
                state=res.parsed.state,
                cpu_count=res.parsed.cpu_count,
                memory_mb=res.parsed.memory_mb,
                _envd_version=res.parsed.envd_version,
                _envd_access_token=res.parsed.envd_access_token,
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
        proxy: Optional[ProxyTypes] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        async with AsyncApiClient(
            config,
            limits=SandboxApiBase._limits,
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
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> None:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        if config.debug:
            # Skip setting the timeout in debug mode
            return

        async with AsyncApiClient(
            config,
            limits=SandboxApiBase._limits,
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
        metadata: Optional[Dict[str, str]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        secure: Optional[bool] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        async with AsyncApiClient(
            config,
            limits=SandboxApiBase._limits,
        ) as api_client:
            res = await post_sandboxes.asyncio_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    secure=secure or False,
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
                envd_access_token=res.parsed.envd_access_token,
            )
