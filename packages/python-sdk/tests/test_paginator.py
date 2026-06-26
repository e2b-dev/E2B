import pytest

from e2b.connection_config import ApiParams
from e2b.paginator import PaginatorBase


class FakePaginator(PaginatorBase[str, ApiParams]):
    """Minimal paginator that returns canned pages and drives the shared state."""

    def __init__(self, pages):
        super().__init__()
        self._pages = pages
        self._call = 0

    def next_items(self):
        if not self.has_next:
            raise Exception("No more items to fetch")

        items, headers = self._pages[self._call]
        self._call += 1
        self._update_pagination(headers)
        return items


def test_paginator_exposes_state_and_advances():
    paginator = FakePaginator(
        [
            (["a", "b"], {"x-next-token": "tok-2"}),
            (["c"], {}),
        ]
    )

    assert paginator.has_next is True
    assert paginator.next_token is None

    first = paginator.next_items()
    assert first == ["a", "b"]
    assert paginator.has_next is True
    assert paginator.next_token == "tok-2"

    second = paginator.next_items()
    assert second == ["c"]
    assert paginator.has_next is False
    assert paginator.next_token is None


def test_paginator_raises_once_exhausted():
    paginator = FakePaginator([([], {})])
    paginator.next_items()

    assert paginator.has_next is False
    with pytest.raises(Exception, match="No more items to fetch"):
        paginator.next_items()
