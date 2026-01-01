import urllib.parse
from typing import Optional, List

from e2b.api.client.api.sandboxes import get_v2_sandboxes
from e2b.api.client.types import UNSET
from e2b.exceptions import SandboxException
from e2b.sandbox.sandbox_api import SandboxPaginatorBase, SandboxInfo
from e2b.api import handle_api_exception
from e2b.api.client.models.error import Error
from e2b.api.client_async import get_api_client


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

        api_client = get_api_client(self._config)
        res = await get_v2_sandboxes.asyncio_detailed(
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
