from typing import Generic, Mapping, Optional, TypeVar

from typing_extensions import Unpack

from e2b.connection_config import ApiParams

T = TypeVar("T")
OptsT = TypeVar("OptsT", bound=ApiParams)


class PaginatorBase(Generic[T, OptsT]):
    """
    Shared pagination state for cursor-based list endpoints.

    Owns the `has_next` / `next_token` state and the reading of the
    `x-next-token` response header (via `_update_pagination`). Each concrete
    paginator implements `next_items` to do the actual fetching for its
    endpoint, so any model can expose pagination by subclassing this without
    reimplementing the bookkeeping.

    `T` is the item type returned by `next_items`; `OptsT` is the connection
    options type accepted by the paginator (an `ApiParams`-compatible TypedDict).
    """

    def __init__(
        self,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[OptsT],
    ):
        self._opts: OptsT = opts
        self.limit = limit
        self._has_next = True
        self._next_token = next_token

    @property
    def has_next(self) -> bool:
        """
        Returns True if there are more items to fetch.
        """
        return self._has_next

    @property
    def next_token(self) -> Optional[str]:
        """
        Returns the next token to use for pagination.
        """
        return self._next_token

    def _update_pagination(self, headers: Mapping[str, str]) -> None:
        self._next_token = headers.get("x-next-token")
        self._has_next = bool(self._next_token)
