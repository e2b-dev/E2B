import urllib.parse
from typing import Optional, List, Unpack

from e2b.api.client.api.sandboxes import (
    get_v2_sandboxes,
    get_v_2_sandboxes_sandbox_id_logs,
)
from e2b.api.client.api.snapshots import get_snapshots
from e2b.api.client.types import UNSET
from e2b.connection_config import ApiParams, ConnectionConfig, merge_api_params
from e2b.exceptions import (
    InvalidArgumentException,
    SandboxException,
    SandboxNotFoundException,
)
from e2b.sandbox.sandbox_api import (
    SandboxPaginatorBase,
    SandboxInfo,
    SandboxLogEntry,
    SandboxLogsPaginatorBase,
    SnapshotPaginatorBase,
    SnapshotInfo,
)
from e2b.api import handle_api_exception
from e2b.api.client.models.error import Error
from e2b.api.client.models.log_level import LogLevel
from e2b.api.client.models.logs_direction import LogsDirection
from e2b.api.client.models.order_direction import OrderDirection
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

    async def next_items(self, **opts: Unpack[ApiParams]) -> List[SandboxInfo]:
        """
        Returns the next page of sandboxes.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options on top of the ones the paginator was constructed with.

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

        if self.order is None:
            order = UNSET
        else:
            try:
                order = OrderDirection(self.order)
            except ValueError:
                raise InvalidArgumentException(
                    f"Invalid order {self.order!r}, expected 'asc' or 'desc'"
                )

        config = ConnectionConfig(**merge_api_params(self._opts, opts))
        api_client = get_api_client(config)
        res = await get_v2_sandboxes.asyncio_detailed(
            client=api_client,
            metadata=metadata if metadata else UNSET,
            state=self.query.state if self.query and self.query.state else UNSET,
            started_after=(
                self.query.started_after.astimezone()
                if self.query and self.query.started_after
                else UNSET
            ),
            template=(
                self.query.template if self.query and self.query.template else UNSET
            ),
            order=order,
            limit=self.limit if self.limit else UNSET,
            next_token=self._next_token if self._next_token else UNSET,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        self._update_pagination(res.headers)

        if res.parsed is None:
            return []

        # Check if res.parsed is Error
        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return [SandboxInfo._from_listed_sandbox(sandbox) for sandbox in res.parsed]


class AsyncSnapshotPaginator(SnapshotPaginatorBase):
    """
    Paginator for listing snapshots.

    Example:
    ```python
    paginator = AsyncSandbox.list_snapshots()

    while paginator.has_next:
        snapshots = await paginator.next_items()
        print(snapshots)
    ```
    """

    async def next_items(self, **opts: Unpack[ApiParams]) -> List[SnapshotInfo]:
        """
        Returns the next page of snapshots.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options on top of the ones the paginator was constructed with.

        :returns: List of snapshots
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        config = ConnectionConfig(**merge_api_params(self._opts, opts))
        api_client = get_api_client(config)
        res = await get_snapshots.asyncio_detailed(
            client=api_client,
            sandbox_id=self.sandbox_id if self.sandbox_id else UNSET,
            name=self.name if self.name else UNSET,
            limit=self.limit if self.limit else UNSET,
            next_token=self._next_token if self._next_token else UNSET,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        self._update_pagination(res.headers)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return [
            SnapshotInfo(
                snapshot_id=snapshot.snapshot_id,
                names=list(snapshot.names) if snapshot.names else [],
            )
            for snapshot in res.parsed
        ]


class AsyncSandboxLogsPaginator(SandboxLogsPaginatorBase):
    """
    Paginator for reading sandbox logs.

    Example:
    ```python
    paginator = sandbox.get_logs()

    while paginator.has_next:
        logs = await paginator.next_items()
        print(logs)
    ```
    """

    async def next_items(self, **opts: Unpack[ApiParams]) -> List[SandboxLogEntry]:
        """
        Returns the next page of sandbox logs.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options on top of the ones the paginator was constructed with.

        :returns: List of log entries

        :raises SandboxNotFoundException: If the sandbox does not exist
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        config = ConnectionConfig(**merge_api_params(self._opts, opts))

        if config.debug:
            # Skip getting the logs in debug mode
            self._has_next = False
            return []

        page_size = self._page_size()
        api_client = get_api_client(config)
        res = await get_v_2_sandboxes_sandbox_id_logs.asyncio_detailed(
            self.sandbox_id,
            client=api_client,
            cursor=self._cursor if self._cursor is not None else UNSET,
            direction=LogsDirection(self.direction) if self.direction else UNSET,
            limit=page_size,
            level=LogLevel(self.level) if self.level else UNSET,
            search=self.search if self.search is not None else UNSET,
        )

        if res.status_code == 404:
            raise SandboxNotFoundException(f"Sandbox {self.sandbox_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            self._has_next = False
            return []

        if isinstance(res.parsed, Error):
            raise SandboxException(f"{res.parsed.message}: Request failed")

        return self._process_page(res.parsed.logs, page_size)
