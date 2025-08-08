import urllib.parse
from typing import Optional, List, Unpack, overload

from e2b.api.client.api.sandboxes import (
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
)
from e2b.api.client.models import ResumedSandbox
from e2b.api.client.types import UNSET
from e2b.api.compatibility import modified_get_v2_sandboxes
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import SandboxException, NotFoundException
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.sandbox_api import SandboxPaginatorBase, SandboxInfo, SandboxQueryBeta
from e2b.api import AsyncApiClient, handle_api_exception
from e2b.api.client.models.error import Error
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_async.main import AsyncSandbox


class AsyncSandboxPaginator(SandboxPaginatorBase):
    """
    Paginator for listing sandboxes.

    Example:
    ```python
    paginator = AsyncSandbox.list()

    while paginator.has_next:
        sandboxes = await paginator.next_items()
        print(sandboxes)
    ```
    """

    async def next_items(self) -> List[SandboxInfo]:
        """
        Returns the next page of sandboxes.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :returns: List of sandboxes
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        # Convert filters to the format expected by the API
        metadata: Optional[str] = None
        if self.query and self.query.metadata:
            quoted_metadata = {
                urllib.parse.quote(k): urllib.parse.quote(v)
                for k, v in self.query.metadata.items()
            }
            metadata = urllib.parse.urlencode(quoted_metadata)

        async with AsyncApiClient(
            self._config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = await modified_get_v2_sandboxes.asyncio_detailed(
                client=api_client,
                metadata=metadata if metadata else UNSET,
                state=self.query.state if self.query and self.query.state else UNSET,
                limit=self.limit if self.limit else UNSET,
                next_token=self._next_token if self._next_token else UNSET,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            self._next_token = res.headers.get("x-next-token")
            self._has_next = bool(self._next_token)

            if res.parsed is None:
                return []

            # Check if res.parse is Error
            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            return [SandboxInfo._from_listed_sandbox(sandbox) for sandbox in res.parsed]


class AsyncSandboxBeta(AsyncSandbox):
    @classmethod
    def list(
        cls,
        query: Optional[SandboxQueryBeta] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> AsyncSandboxPaginator:
        """
        List all running sandboxes.

        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxListQuery(metadata={"key": "value"})` or `SandboxListQuery(state=[SandboxState.RUNNING])`
        :param limit: Maximum number of sandboxes to return
        :param next_token: Token for pagination

        :return: List of running sandboxes
        """
        return AsyncSandboxPaginator(
            query=query,
            limit=limit,
            next_token=next_token,
            **opts,
        )

    @overload
    async def pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox.

        :return: Sandbox ID that can be used to resume the sandbox
        """
        ...

    @overload
    @staticmethod
    async def pause(
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID

        :return: Sandbox ID that can be used to resume the sandbox
        """
        ...

    @class_method_variant("_cls_pause")
    async def pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: Sandbox ID that can be used to resume the sandbox
        """

        await self._cls_pause(
            sandbox_id=self.sandbox_id,
            **opts,
        )

        return self.sandbox_id

    @classmethod
    async def _cls_pause(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
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
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True

    @overload
    async def resume(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox.

        :return: Sandbox ID that can be used to resume the sandbox
        """
        ...

    @overload
    @staticmethod
    async def resume(
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Resume the sandbox.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """
        ...

    @class_method_variant("_cls_resume")
    async def resume(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ):
        """
        Resume the sandbox.

        The **default sandbox timeout of 300 seconds** will be used for the resumed sandbox.
        If you pass a custom timeout via the `timeout` parameter, it will be used instead.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """

        await self._cls_resume(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **opts,
        )

        return await self.connect(
            sandbox_id=self.sandbox_id,
            **opts,
        )

    @classmethod
    async def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> bool:
        timeout = timeout or SandboxBase.default_sandbox_timeout

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
